// Utility functions for Enterprise Attendance Security, GPS calculation, and HMAC signatures

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface GpsRadiusEvaluation {
  allowedRadius: number;
  status: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  description: string;
  isAcceptable: boolean;
}

export function evaluateGpsAccuracyRadius(accuracyMeters: number): GpsRadiusEvaluation {
  if (isNaN(accuracyMeters) || accuracyMeters <= 0) {
    return {
      allowedRadius: 30,
      status: "POOR",
      description: "Invalid GPS Signal",
      isAcceptable: false
    };
  }

  if (accuracyMeters <= 15) {
    return {
      allowedRadius: 30,
      status: "EXCELLENT",
      description: "Very High Accuracy (≤15m)",
      isAcceptable: true
    };
  } else if (accuracyMeters <= 30) {
    return {
      allowedRadius: 40,
      status: "GOOD",
      description: "Good Accuracy (15m-30m)",
      isAcceptable: true
    };
  } else if (accuracyMeters <= 50) {
    return {
      allowedRadius: 60,
      status: "FAIR",
      description: "Fair Accuracy (30m-50m)",
      isAcceptable: true
    };
  } else {
    return {
      allowedRadius: 0,
      status: "POOR",
      description: "Poor Accuracy (>50m) - Waiting for better GPS signal...",
      isAcceptable: false
    };
  }
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server-device-id";
  let deviceId = localStorage.getItem("app_device_fingerprint");
  if (!deviceId) {
    const userAgentHash = btoa(navigator.userAgent.slice(0, 30));
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    deviceId = `DEV-${userAgentHash.slice(0, 8)}-${randomHex}`;
    localStorage.setItem("app_device_fingerprint", deviceId);
  }
  return deviceId;
}

export function getDeviceDisplayName(): string {
  if (typeof window === "undefined") return "Unknown Device";
  const ua = navigator.userAgent;
  let os = "Mobile Phone";
  if (/Android/i.test(ua)) {
    if (/Samsung/i.test(ua)) os = "Samsung Galaxy Phone";
    else if (/Pixel/i.test(ua)) os = "Google Pixel Phone";
    else if (/Xiaomi|Redmi|POCO/i.test(ua)) os = "Xiaomi / Redmi Phone";
    else if (/Huawei|Honor/i.test(ua)) os = "Huawei Phone";
    else if (/Tecno/i.test(ua)) os = "Tecno Mobile Phone";
    else if (/Infinix/i.test(ua)) os = "Infinix Mobile Phone";
    else os = "Android Mobile Phone";
  } else if (/iPhone/i.test(ua)) {
    os = "Apple iPhone";
  } else if (/iPad/i.test(ua)) {
    os = "Apple iPad";
  } else if (/Windows/i.test(ua)) {
    os = "Windows Desktop";
  } else if (/Macintosh/i.test(ua)) {
    os = "MacBook / macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux Terminal";
  }

  let browser = "Browser";
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Opera|OPR/i.test(ua)) browser = "Opera";

  return `${os} (${browser})`;
}

export interface QrPayload {
  workspace_id: number;
  token_id: string;
  timestamp: number;
  signature?: string;
}

// Client-side helper to parse scanned QR token
export function parseQrToken(rawQrText: string): QrPayload | null {
  try {
    const trimmed = rawQrText.trim();
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed) as QrPayload;
    }
    if (trimmed.startsWith("AISTUDIO-QR:")) {
      const jsonStr = atob(trimmed.replace("AISTUDIO-QR:", ""));
      return JSON.parse(jsonStr) as QrPayload;
    }
    // Legacy support for plain string codes
    return null;
  } catch (e) {
    return null;
  }
}
