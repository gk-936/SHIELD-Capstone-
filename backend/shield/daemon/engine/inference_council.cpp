#include "inference_council.h"
#include "feature_types.h"
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cmath>
#include <algorithm>
#include <vector>
#include <cstring>
#include "model_weights.h"

namespace shield {

InferenceCouncil::InferenceCouncil() : last_score_(0.0f) {}

int InferenceCouncil::Predict(const std::vector<float>& features) {
    if (features.size() < FeatureVector::FEATURE_COUNT) return 0;

    int sock = -1;
    struct sockaddr_in serv_addr;

    if ((sock = socket(AF_INET, SOCK_STREAM, 0)) < 0) return 0;

    serv_addr.sin_family = AF_INET;
    serv_addr.sin_port = htons(8888);

    if (inet_pton(AF_INET, "127.0.0.1", &serv_addr.sin_addr) <= 0) {
        close(sock);
        return 0;
    }

    if (connect(sock, (struct sockaddr *)&serv_addr, sizeof(serv_addr)) < 0) {
        close(sock);
        return 0;
    }

    // Send 26 doubles (8 bytes each) to match Python's struct.unpack('26d')
    std::vector<double> d_features(features.begin(), features.end());
    if (send(sock, (char*)d_features.data(), 26 * 8, 0) == -1) {
        close(sock);
        return 0;
    }

    // Receive decision (1 byte)
    unsigned char decision = 0;
    int bytesReceived = read(sock, (char*)&decision, 1);
    
    close(sock);
    
    if (bytesReceived <= 0) return 0; // Error or No Decision
    
    last_score_ = (float)decision / 2.0f; // Scale decision to 0.0-1.0 roughly
    return (int)decision; // 0=Benign, 1=Suspicious, 2=Ransomware
}

} // namespace shield
