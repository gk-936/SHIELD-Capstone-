import type { DecisionLevel } from '../types';

// Format timestamp to readable date
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

// Format timestamp to short time
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

// Format duration in milliseconds to human readable
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Calculate time difference in human readable format
export function timeSinceAlert(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// Get color based on score and threshold
export function getScoreColor(score: number): string {
  if (score < 0.2) return '#22c55e'; // BENIGN - green
  if (score < 0.35) return '#eab308'; // SUSPICIOUS - yellow
  if (score < 0.59) return '#f97316'; // MEDIUM - amber
  if (score < 0.85) return '#ef4444'; // HIGH - red
  return '#991b1b'; // CONFIRMED - dark red
}

// Get decision level based on score
export function getDecisionLevel(score: number): DecisionLevel {
  if (score < 0.2) return 'BENIGN';
  if (score < 0.35) return 'SUSPICIOUS';
  if (score < 0.59) return 'MEDIUM';
  if (score < 0.85) return 'HIGH';
  return 'CONFIRMED';
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Format large numbers with K, M, B suffixes
export function formatNumber(value: number): string {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toFixed(0);
}

// Truncate string with ellipsis
export function truncate(str: string, length: number = 20): string {
  return str.length > length ? `${str.substring(0, length)}...` : str;
}

// Calculate entropy color
export function getEntropyColor(entropy: number): string {
  // 0-8 scale, blue (low) to red (high)
  const intensity = Math.min(1, entropy / 8);
  if (intensity < 0.33) return '#0088ff'; // Blue
  if (intensity < 0.66) return '#ffdd00'; // Yellow
  return '#ff4444'; // Red
}

// Check if value is critical
export function isCritical(latency: number, threshold: number): boolean {
  return latency > threshold;
}

// Generate CSV from data
export function generateCSV(headers: string[], data: any[][]): string {
  const csvHeaders = headers.map(h => `"${h}"`).join(',');
  const csvData = data.map(row =>
    row.map(cell => {
      if (typeof cell === 'string') return `"${cell.replace(/"/g, '""')}"`;
      return cell;
    }).join(',')
  ).join('\n');
  
  return `${csvHeaders}\n${csvData}`;
}

// Download file
export function downloadFile(content: string, filename: string, type: string = 'text/plain'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate mock signed URL
export function generateSignedUrl(reportId: string, format: 'pdf' | 'json'): Promise<string> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(`https://api.shield.local/reports/${reportId}/download?format=${format}&token=signed_${Date.now()}`);
    }, 500);
  });
}

// Check if latency is high
export function isHighLatency(latency: number, threshold: number = 50): boolean {
  return latency > threshold;
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Linear interpolation
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
