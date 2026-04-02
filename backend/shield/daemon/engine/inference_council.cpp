#include "inference_council.h"
#include <winsock2.h>
#include <ws2tcpip.h>
#include <iostream>
#include <vector>

#pragma comment(lib, "ws2_32.lib")

namespace shield {

InferenceCouncil::InferenceCouncil() : last_score_(0.0f) {
    // Initialize Winsock
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);
}

InferenceCouncil::~InferenceCouncil() {
    WSACleanup();
}

int InferenceCouncil::Predict(const std::vector<float>& features) {
    if (features.size() < FeatureVector::FEATURE_COUNT) return 0;

    SOCKET ConnectSocket = INVALID_SOCKET;
    struct addrinfo *result = NULL, *ptr = NULL, hints;

    ZeroMemory(&hints, sizeof(hints));
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;

    // Connect to S.H.I.E.L.D. Async Server (Python)
    if (getaddrinfo("127.0.0.1", "8888", &hints, &result) != 0) return 0;

    for (ptr = result; ptr != NULL; ptr = ptr->ai_next) {
        ConnectSocket = socket(ptr->ai_family, ptr->ai_socktype, ptr->ai_protocol);
        if (ConnectSocket == INVALID_SOCKET) return 0;
        if (connect(ConnectSocket, ptr->ai_addr, (int)ptr->ai_addrlen) == SOCKET_ERROR) {
            closesocket(ConnectSocket);
            ConnectSocket = INVALID_SOCKET;
            continue;
        }
        break;
    }

    freeaddrinfo(result);
    if (ConnectSocket == INVALID_SOCKET) return 0;

    // Send 26 doubles (8 bytes each) to match Python's struct.unpack('26d')
    // We convert the float vector to double for higher precision communication
    std::vector<double> d_features(features.begin(), features.end());
    if (send(ConnectSocket, (char*)d_features.data(), 26 * 8, 0) == SOCKET_ERROR) {
        closesocket(ConnectSocket);
        return 0;
    }

    // Receive decision (1 byte)
    unsigned char decision = 0;
    int bytesReceived = recv(ConnectSocket, (char*)&decision, 1, 0);
    
    closesocket(ConnectSocket);
    
    if (bytesReceived <= 0) return 0; // Error or No Decision
    
    return (int)decision; // 0=Benign, 1=Suspicious, 2=Ransomware
}

} // namespace shield
