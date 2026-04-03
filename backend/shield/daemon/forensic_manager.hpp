#ifndef __SHIELD_FORENSIC_MANAGER_HPP
#define __SHIELD_FORENSIC_MANAGER_HPP

#include <vector>
#include <string>
#include <fstream>
#include <mutex>
#include <iostream>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <sys/stat.h>
#include <dirent.h>
#include <unistd.h>

namespace shield {

class ForensicManager {
public:
    static ForensicManager& Get() {
        static ForensicManager instance;
        return instance;
    }

    void Init(const std::string& sandbox_path, const std::string& vault_path) {
        sandbox_path_ = sandbox_path;
        vault_path_ = vault_path;
        mkdir(vault_path_.c_str(), 0777);
        LoadHistory();
    }

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

    bool CreateSnapshot(uint32_t pid, const std::string& comm) {
        std::string backup_dir = vault_path_ + "/backup_" + std::to_string(pid);
        mkdir(backup_dir.c_str(), 0777);

        // Simple directory copy (v7.5)
        std::string cmd = "cp -rp " + sandbox_path_ + "/* " + backup_dir + "/ 2>/dev/null";
        int ret = system(cmd.c_str());
        
        if (ret == 0) {
            std::cout << "[🛡️] Secure Snapshot Vaulted for PID " << pid << " (" << comm << ")" << std::endl;
            return true;
        }
        return false;
    }

    bool Rollback(uint32_t pid) {
        std::string backup_dir = vault_path_ + "/backup_" + std::to_string(pid);
        
        struct stat info;
        if (stat(backup_dir.c_str(), &info) != 0) return false;

        // Restore: rm sandbox -> cp vault content
        std::string clean_cmd = "rm -rf " + sandbox_path_ + "/*";
        if (system(clean_cmd.c_str()) != 0) {
            std::cerr << "[🛡️] Warning: Sandbox cleanup returned non-zero. Proceeding with sync." << std::endl;
        }

        std::string restore_cmd = "cp -rp " + backup_dir + "/* " + sandbox_path_ + "/";
        int ret = system(restore_cmd.c_str());

        if (ret == 0) {
            std::cout << "[🛡️] ROLLBACK SUCCESSFUL for PID context " << pid << ". Data Integrity Restored." << std::endl;
            return true;
        }
        return false;
    }

private:
    ForensicManager() {}
    
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

    std::string sandbox_path_;
    std::string vault_path_;
    std::vector<std::string> history_;
    std::mutex mutex_;
};

} // namespace shield

#endif
