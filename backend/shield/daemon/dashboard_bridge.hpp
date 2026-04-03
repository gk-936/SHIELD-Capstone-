#ifndef __SHIELD_DASHBOARD_BRIDGE_HPP
#define __SHIELD_DASHBOARD_BRIDGE_HPP

#include <iostream>
#include <vector>
#include <string>
#include <thread>
#include <mutex>
#include <algorithm>
#include <cstring>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <openssl/sha.h>
#include <openssl/bio.h>
#include <openssl/evp.h>
#include <openssl/buffer.h>
#include <functional>
#include <poll.h>

namespace shield {

class DashboardBridge {
public:
    DashboardBridge(int port = 8080) : port_(port), running_(false), server_fd_(-1) {}
    ~DashboardBridge() { Stop(); }

    void Start() {
        if (running_) return;
        running_ = true;
        server_thread_ = std::thread(&DashboardBridge::Run, this);
    }

    void Stop() {
        running_ = false;
        if (server_fd_ != -1) shutdown(server_fd_, SHUT_RDWR);
        if (server_thread_.joinable()) server_thread_.join();
    }

    void SetMessageCallback(std::function<void(const std::string&)> cb) {
        message_callback_ = cb;
    }

    void PushUpdate(const std::string& json) {
        std::lock_guard<std::mutex> lock(clients_mutex_);
        std::vector<uint8_t> frame = CreateWebSocketFrame(json);
        
        auto it = client_fds_.begin();
        while (it != client_fds_.end()) {
            if (send(*it, frame.data(), frame.size(), MSG_NOSIGNAL) == -1) {
                close(*it);
                it = client_fds_.erase(it);
            } else {
                ++it;
            }
        }
    }

private:
    void Run() {
        server_fd_ = socket(AF_INET, SOCK_STREAM, 0);
        int opt = 1;
        setsockopt(server_fd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

        struct sockaddr_in address;
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = INADDR_ANY;
        address.sin_port = htons(port_);

        if (bind(server_fd_, (struct sockaddr*)&address, sizeof(address)) < 0) {
            std::cerr << "[🛡️] Bridge Error: Bind failed on port " << port_ << std::endl;
            return;
        }

        listen(server_fd_, 5);
        std::cout << "[🛡️] Dashboard Bridge active on port " << port_ << " (Bi-directional)" << std::endl;

        std::vector<struct pollfd> poll_fds;
        
        while (running_) {
            poll_fds.clear();
            poll_fds.push_back({server_fd_, POLLIN, 0});
            
            {
                std::lock_guard<std::mutex> lock(clients_mutex_);
                for (int fd : client_fds_) {
                    poll_fds.push_back({fd, POLLIN, 0});
                }
            }

            int ret = poll(poll_fds.data(), poll_fds.size(), 1000);
            if (ret <= 0) continue;

            // Handle new connections
            if (poll_fds[0].revents & POLLIN) {
                struct sockaddr_in client_addr;
                socklen_t addrlen = sizeof(client_addr);
                int new_socket = accept(server_fd_, (struct sockaddr*)&client_addr, &addrlen);
                if (new_socket >= 0) {
                    if (HandleHandshake(new_socket)) {
                        std::lock_guard<std::mutex> lock(clients_mutex_);
                        client_fds_.push_back(new_socket);
                        std::cout << "[🛡️] Dashboard client connected." << std::endl;
                    } else {
                        close(new_socket);
                    }
                }
            }

            // Handle incoming data from clients
            for (size_t i = 1; i < poll_fds.size(); ++i) {
                if (poll_fds[i].revents & POLLIN) {
                    if (!HandleIncomingData(poll_fds[i].fd)) {
                        std::lock_guard<std::mutex> lock(clients_mutex_);
                        int fd = poll_fds[i].fd;
                        close(fd);
                        client_fds_.erase(std::remove(client_fds_.begin(), client_fds_.end(), fd), client_fds_.end());
                        std::cout << "[🛡️] Dashboard client disconnected." << std::endl;
                    }
                }
            }
        }
    }

    bool HandleIncomingData(int fd) {
        uint8_t header[2];
        if (recv(fd, header, 2, 0) <= 0) return false;

        uint8_t opcode = header[0] & 0x0F;
        if (opcode == 0x08) return false; // Close frame

        bool masked = header[1] & 0x80;
        size_t payload_len = header[1] & 0x7F;

        if (payload_len == 126) {
            uint16_t extra;
            recv(fd, &extra, 2, 0);
            payload_len = ntohs(extra);
        } else if (payload_len == 127) {
            return false; // Long payloads not supported for settings
        }

        uint8_t mask[4];
        if (masked) {
            recv(fd, mask, 4, 0);
        }

        std::vector<uint8_t> payload(payload_len);
        if (recv(fd, payload.data(), payload_len, 0) != (ssize_t)payload_len) return false;

        if (masked) {
            for (size_t i = 0; i < payload_len; ++i) {
                payload[i] ^= mask[i % 4];
            }
        }

        std::string message((char*)payload.data(), payload_len);
        if (message_callback_) {
            message_callback_(message);
        }

        return true;
    }

    bool HandleHandshake(int socket) {
        char buffer[2048] = {0};
        int valread = read(socket, buffer, 2048);
        if (valread <= 0) return false;

        std::string request(buffer);
        size_t key_pos = request.find("Sec-WebSocket-Key: ");
        if (key_pos == std::string::npos) return false;

        size_t key_end = request.find("\r\n", key_pos);
        std::string key = request.substr(key_pos + 19, key_end - (key_pos + 19));
        
        std::string magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        std::string accept_key = CalculateAcceptKey(key + magic);

        std::string response = 
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Accept: " + accept_key + "\r\n\r\n";

        send(socket, response.c_str(), response.length(), 0);
        return true;
    }

    std::string CalculateAcceptKey(const std::string& input) {
        unsigned char hash[SHA_DIGEST_LENGTH];
        SHA1((const unsigned char*)input.c_str(), input.length(), hash);
        
        BIO *b64 = BIO_new(BIO_f_base64());
        BIO *bmem = BIO_new(BIO_s_mem());
        b64 = BIO_push(b64, bmem);
        BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
        BIO_write(b64, hash, SHA_DIGEST_LENGTH);
        BIO_flush(b64);
        
        BUF_MEM *bptr;
        BIO_get_mem_ptr(b64, &bptr);
        std::string result(bptr->data, bptr->length);
        BIO_free_all(b64);
        return result;
    }

    std::vector<uint8_t> CreateWebSocketFrame(const std::string& message) {
        std::vector<uint8_t> frame;
        frame.push_back(0x81); // FIN + Text frame Opcode

        if (message.length() <= 125) {
            frame.push_back((uint8_t)message.length());
        } else if (message.length() <= 65535) {
            frame.push_back(126);
            frame.push_back((message.length() >> 8) & 0xFF);
            frame.push_back(message.length() & 0xFF);
        } else {
            frame.push_back(127);
            for (int i = 7; i >= 0; --i) frame.push_back((message.length() >> (i * 8)) & 0xFF);
        }
        
        frame.insert(frame.end(), message.begin(), message.end());
        return frame;
    }

    int port_;
    int server_fd_;
    bool running_;
    std::thread server_thread_;
    std::vector<int> client_fds_;
    std::mutex clients_mutex_;
    std::function<void(const std::string&)> message_callback_;
};

extern DashboardBridge g_dashboard;

} // namespace shield

#endif
