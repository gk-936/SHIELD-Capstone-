#ifndef __SHIELD_FORENSIC_MANAGER_HPP
#define __SHIELD_FORENSIC_MANAGER_HPP

#include <vector>
#include <string>
#include <fstream>
#include <mutex>
#include <thread>
#include <unordered_set>
#include <iostream>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <sys/stat.h>
#include <sys/types.h>
#include <dirent.h>
#include <unistd.h>
#include <algorithm>
#include <ctime>

namespace shield {

class ForensicManager {
public:
    static ForensicManager& Get() {
        static ForensicManager instance;
        return instance;
    }

    void Init(const std::string& sandbox_path, const std::string& vault_path) {
        sandbox_path_ = sandbox_path;
        vault_path_   = vault_path;
        mkdir(vault_path_.c_str(), 0777);
        std::cout << "[\U0001f6e1\ufe0f] Forensic Hub Initialized." << std::endl;
        std::cout << "    - Sandbox: " << sandbox_path_ << std::endl;
        std::cout << "    - Vault:   " << vault_path_ << std::endl;
        LoadHistory();
    }

    // ─── Alert History ───────────────────────────────────────────────────────
    void LogAlert(const std::string& alert_json) {
        std::lock_guard<std::mutex> lock(mutex_);
        history_.push_back(alert_json);
        if (history_.size() > 100) history_.erase(history_.begin());
        AppendToDisk(alert_json);
    }

    std::vector<std::string> GetHistory() {
        std::lock_guard<std::mutex> lock(mutex_);
        return history_;
    }

    // ─── Snapshot ─────────────────────────────────────────────────────────────
    bool CreateSnapshot(uint32_t pid, const std::string& comm, const std::string& level = "MEDIUM") {
        std::lock_guard<std::mutex> lock(snapshot_mut_);
        if (snapshots_taken_.count(pid)) return true;
        snapshots_taken_.insert(pid);

        std::string key = "backup_" + std::to_string(pid);
        std::string backup_dir = vault_path_ + "/" + key;
        mkdir(backup_dir.c_str(), 0777);

        std::thread([this, pid, comm, level, key, backup_dir]() {
            std::string cmd = "cp -a " + sandbox_path_ + "/. " + backup_dir + "/ 2>/tmp/shield_cp_err.log";
            int ret = system(cmd.c_str());

            if (ret == 0) {
                // Write metadata file
                std::ofstream meta(backup_dir + "/.shield_meta");
                meta << "{\"pid\":" << pid
                     << ",\"comm\":\"" << comm << "\""
                     << ",\"level\":\"" << level << "\""
                     << ",\"timestamp\":" << CurrentTimeMs()
                     << "}";
                std::cout << "[\U0001f6e1\ufe0f] Secure Snapshot: " << key << " ("  << comm << ")" << std::endl;
            } else {
                std::cerr << "[\U0001f6e1\ufe0f] Snapshot Error: Copy failed for " << key << " (ret=" << ret << ")" << std::endl;
                system(("rm -rf " + backup_dir).c_str()); // Clean up empty dir     
            }
        }).detach();

        return true;
    }

    bool ManualSnapshot() {
        if (sandbox_path_.empty() || vault_path_.empty()) {
            std::cerr << "[\U0001f6e1\ufe0f] Snapshot failed: ForensicManager not initialized. Call Init() first." << std::endl;
            return false;
        }
        std::string ts = std::to_string(CurrentTimeMs());
        std::string key = "manual_" + ts;
        std::string backup_dir = vault_path_ + "/" + key;
        mkdir(backup_dir.c_str(), 0777);

        std::string cmd = "cp -a " + sandbox_path_ + "/. " + backup_dir + "/ 2>/tmp/shield_manual_err.log";
        int ret = system(cmd.c_str());

        if (ret == 0) {
            std::ofstream meta(backup_dir + "/.shield_meta");
            meta << "{\"pid\":0,\"comm\":\"manual\",\"level\":\"MANUAL\",\"timestamp\":" << ts << "}";
            std::cout << "[\U0001f6e1\ufe0f] Manual Snapshot Captured: " << key << std::endl;
            return true;
        } else {
            std::cerr << "[\U0001f6e1\ufe0f] Manual Snapshot Failed: Copy error (ret=" << ret << ")" << std::endl;
            system(("rm -rf " + backup_dir).c_str());
            return false;
        }
    }

    // ─── Rollback ────────────────────────────────────────────────────────────
    bool Rollback(uint32_t pid) {
        std::string backup_dir = vault_path_ + "/backup_" + std::to_string(pid);
        struct stat info;
        if (stat(backup_dir.c_str(), &info) != 0) return false;
        return RestoreFrom(backup_dir);
    }

    bool RollbackByKey(const std::string& key) {
        std::string backup_dir = vault_path_ + "/" + key;
        struct stat info;
        if (stat(backup_dir.c_str(), &info) != 0) return false;
        return RestoreFrom(backup_dir);
    }

    // ─── Delete ───────────────────────────────────────────────────────────────
    bool DeleteSnapshot(const std::string& key) {
        // Safety: only allow keys matching known patterns
        if (key.find("..") != std::string::npos) return false;
        std::string cmd = "rm -rf " + vault_path_ + "/" + key;
        return system(cmd.c_str()) == 0;
    }

    bool ClearAllSnapshots() {
        std::string cmd = "rm -rf " + vault_path_ + "/backup_* " + vault_path_ + "/manual_*";
        return system(cmd.c_str()) == 0;
    }

    // ─── Vault Status JSON ────────────────────────────────────────────────────
    std::string GetVaultStatusJSON() {
        std::vector<std::string> snapshots;
        long long totalSize = 0;
        long long lastTime = 0;
        std::vector<std::pair<long long, std::string>> recentFiles;

        DIR* dir = opendir(vault_path_.c_str());
        if (dir) {
            struct dirent* entry;
            while ((entry = readdir(dir)) != nullptr) {
                std::string name(entry->d_name);
                if (name == "." || name == "..") continue;
                if (name.compare(0, 7, "backup_") != 0 && name.compare(0, 7, "manual_") != 0) continue;

                std::string snap_dir = vault_path_ + "/" + name;
                long long snap_size = DirSize(snap_dir);
                totalSize += snap_size;

                // Read metadata
                std::string meta_path = snap_dir + "/.shield_meta";
                std::ifstream mf(meta_path);
                std::string meta_content((std::istreambuf_iterator<char>(mf)), {});

                long long ts = ExtractLong(meta_content, "\"timestamp\":");
                if (ts > lastTime) lastTime = ts;

                // Collect recent files
                CollectRecentFiles(snap_dir, recentFiles);

                std::string entry_json = "{\"key\":\"" + name + "\""
                    + ",\"sizeBytes\":" + std::to_string(snap_size)
                    + "," + (meta_content.empty() ? "\"pid\":0,\"comm\":\"unknown\",\"level\":\"MEDIUM\",\"timestamp\":0" : meta_content.substr(1, meta_content.size()-2))
                    + "}";
                snapshots.push_back(entry_json);
            }
            closedir(dir);
        }

        // Sort recent files by timestamp, take top 5
        std::sort(recentFiles.begin(), recentFiles.end(), [](auto& a, auto& b){ return a.first > b.first; });
        
        std::string files_json = "[";
        for (int i = 0; i < (int)std::min((size_t)5, recentFiles.size()); i++) {
            if (i > 0) files_json += ",";
            files_json += "\"" + recentFiles[i].second + "\"";
        }
        files_json += "]";

        std::string snaps_json = "[";
        for (size_t i = 0; i < snapshots.size(); i++) {
            if (i > 0) snaps_json += ",";
            snaps_json += snapshots[i];
        }
        snaps_json += "]";

        std::ostringstream out;
        out << "{\"type\":\"vault_status\""
            << ",\"sandboxPath\":\"" << sandbox_path_ << "\""
            << ",\"vaultPath\":\"" << vault_path_ << "\""
            << ",\"totalSnapshots\":" << snapshots.size()
            << ",\"totalSizeBytes\":" << totalSize
            << ",\"lastSnapshotTime\":" << lastTime
            << ",\"snapshots\":" << snaps_json
            << ",\"recentFiles\":" << files_json
            << "}";
        return out.str();
    }

    // Called when paths are updated from dashboard
    void SetPaths(const std::string& sandbox, const std::string& vault) {
        sandbox_path_ = sandbox;
        vault_path_ = vault;
        mkdir(vault_path_.c_str(), 0777);
    }

    // v8.1 — Proactive Snapshot Policy
    void SetPolicy(bool auto_snap, int frequency_mins) {
        auto_snapshot_ = auto_snap;
        frequency_mins_ = frequency_mins;
        last_proactive_ms_ = CurrentTimeMs(); // Reset timer on policy change
        std::cout << "[\U0001f6e1\ufe0f] Vault Policy Updated: AutoSnap=" << (auto_snap?"ON":"OFF") 
                  << " Frequency=" << frequency_mins << "m" << std::endl;
    }

    void Tick() {
        if (frequency_mins_ <= 0) return;

        long long now = CurrentTimeMs();
        if (now - last_proactive_ms_ >= (long long)frequency_mins_ * 60000) {
            std::string ts = std::to_string(now);
            std::string key = "scheduled_" + ts;
            std::string backup_dir = vault_path_ + "/" + key;
            
            if (mkdir(backup_dir.c_str(), 0777) == 0) {
                std::string cmd = "cp -a " + sandbox_path_ + "/. " + backup_dir + "/ 2>/dev/null";
                if (system(cmd.c_str()) == 0) {
                    std::ofstream meta(backup_dir + "/.shield_meta");
                    meta << "{\"pid\":0,\"comm\":\"scheduled\",\"level\":\"MANUAL\",\"timestamp\":" << ts << "}";
                    std::cout << "[\U0001f6e1\ufe0f] Scheduled Proactive Snapshot: " << key << std::endl;
                    last_proactive_ms_ = now;
                } else {
                    system(("rm -rf " + backup_dir).c_str());
                }
            }
        }
    }

private:
    ForensicManager() : auto_snapshot_(true), frequency_mins_(0), last_proactive_ms_(0) {}

    bool RestoreFrom(const std::string& backup_dir) {
        std::string clean_cmd = "rm -rf " + sandbox_path_ + "/*";
        if (system(clean_cmd.c_str()) != 0) {
            std::cerr << "[\U0001f6e1\ufe0f] Warning: Sandbox cleanup returned non-zero." << std::endl;
        }
        std::string restore_cmd = "cp -rp " + backup_dir + "/* " + sandbox_path_ + "/ 2>/dev/null";
        int ret = system(restore_cmd.c_str());
        if (ret == 0) {
            std::cout << "[\U0001f6e1\ufe0f] ROLLBACK SUCCESSFUL from: " << backup_dir << std::endl;
            return true;
        }
        return false;
    }

    long long DirSize(const std::string& path) {
        std::string cmd = "du -sb " + path + " 2>/dev/null | cut -f1";
        FILE* pipe = popen(cmd.c_str(), "r");
        if (!pipe) return 0;
        long long size = 0;
        fscanf(pipe, "%lld", &size);
        pclose(pipe);
        return size;
    }

    void CollectRecentFiles(const std::string& dir_path, std::vector<std::pair<long long, std::string>>& out) {
        DIR* d = opendir(dir_path.c_str());
        if (!d) return;
        struct dirent* e;
        while ((e = readdir(d)) != nullptr) {
            if (e->d_name[0] == '.') continue; // skip hidden/meta
            std::string full = dir_path + "/" + e->d_name;
            struct stat st;
            if (stat(full.c_str(), &st) == 0 && S_ISREG(st.st_mode)) {
                out.push_back({ (long long)st.st_mtime * 1000, std::string(e->d_name) });
            }
        }
        closedir(d);
    }

    long long ExtractLong(const std::string& json, const std::string& key) {
        size_t pos = json.find(key);
        if (pos == std::string::npos) return 0;
        return std::stoll(json.substr(pos + key.size()));
    }

    long long CurrentTimeMs() {
        return std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
    }

    void LoadHistory() {
        std::ifstream f(".shield_forensics.json");
        std::string line;
        while (std::getline(f, line)) {
            if (!line.empty()) history_.push_back(line);
        }
    }

    void AppendToDisk(const std::string& json) {
        std::ofstream f(".shield_forensics.json", std::ios::app);
        f << json << "\n";
    }

    std::unordered_set<uint32_t> snapshots_taken_;
    std::mutex snapshot_mut_;

    std::string sandbox_path_;
    std::string vault_path_;
    std::vector<std::string> history_;
    std::mutex mutex_;

    // v8.1 — Proactive State
    bool auto_snapshot_;
    int frequency_mins_;
    long long last_proactive_ms_;
};

} // namespace shield

#endif
