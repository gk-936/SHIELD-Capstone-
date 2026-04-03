#include "inference_council.h"
#include <cmath>
#include <algorithm>
#include <numeric>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cstring>
#include <iostream>

namespace shield {

InferenceCouncil::InferenceCouncil() : last_score_(0.0f) {
    last_radar_scores_.resize(6, 0.0f);
}

int InferenceCouncil::Predict(const std::vector<float>& features) {
    if (features.size() < 26) return 0;

    // --- PROTOCOL: CONNECT TO PYTHON ML BRAIN ---
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) return 0; 

    struct sockaddr_in serv_addr;
    memset(&serv_addr, 0, sizeof(serv_addr));
    serv_addr.sin_family = AF_INET;
    serv_addr.sin_port = htons(8888);
    inet_pton(AF_INET, "127.0.0.1", &serv_addr.sin_addr);

    // Set timeout (100ms) to prevent daemon lag
    struct timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 100000;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, (const char*)&tv, sizeof(tv));

    if (connect(sock, (struct sockaddr *)&serv_addr, sizeof(serv_addr)) < 0) {
        close(sock);
        // Fallback: Use a very simple local heuristic if brain is offline
        float entropy = features[3]; // MEAN_ENTROPY
        if (entropy > 0.9) return 1; 
        return 0;
    }

    // 1. Send Features (26 doubles = 208 bytes)
    std::vector<double> d_feats;
    for(float f : features) d_feats.push_back((double)f);
    
    if (send(sock, d_feats.data(), d_feats.size() * sizeof(double), 0) < 0) {
        close(sock);
        return 0;
    }

    // 2. Receive Decision (1 byte) + Radar Scores (6 doubles = 48 bytes) = 49 bytes
    uint8_t response[49];
    int valread = recv(sock, response, 49, 0);
    close(sock);

    if (valread == 49) {
        int decision = response[0];
        
        // Extract 6 Radar Scores
        double radar[6];
        memcpy(radar, response + 1, 48);
        
        last_radar_scores_.clear();
        for(int i=0; i<6; i++) last_radar_scores_.push_back((float)radar[i]);
        
        // Update last_score_ for UI consistency and clamp to [0, 1]
        float sum = 0;
        for(float r : last_radar_scores_) sum += r;
        last_score_ = std::min(1.0f, sum / 6.0f); 

        return decision;
    }

    return 0;
}

float InferenceCouncil::ScoreIForest(const std::vector<float>& features, const struct IFNode* tree_base, int tree_count) {
    return 0.5f; 
}

float InferenceCouncil::ScoreHBOS(const std::vector<float>& features) {
    return 0.45f;
}

float InferenceCouncil::ScoreLOF(const std::vector<float>& features) {
    return 1.1f;
}

float InferenceCouncil::ScoreXGBoost(const std::vector<float>& g_features) {
    return 0.2f; 
}

} // namespace shield
