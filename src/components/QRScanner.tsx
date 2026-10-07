import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, 
  UploadCloud, 
  X, 
  Zap, 
  ZapOff, 
  RotateCw, 
  AlertCircle, 
  CheckCircle2, 
  MapPin, 
  ShieldCheck,
  Loader2,
  Info
} from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  onClose: () => void;
  gpsInfo?: {
    accuracy?: number;
    latitude?: number;
    longitude?: number;
  } | null;
  workStatus?: {
    isWorkingDay: boolean;
    label: string;
    description?: string;
  } | null;
}

export const QRScanner: React.FC<QRScannerProps> = ({ 
  onScanSuccess, 
  onScanError, 
  onClose,
  gpsInfo,
  workStatus
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'file'>('camera');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [noCameraHardware, setNoCameraHardware] = useState(false);

  // File upload scan state
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDecodingFile, setIsDecodingFile] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScannerRunningRef = useRef(false);
  const hasScannedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const containerId = "custom-qr-reader";

  // Vibration feedback
  const triggerHaptic = () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
    } catch (e) {}
  };

  const handleSuccess = (decodedText: string) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    triggerHaptic();
    onScanSuccess(decodedText);
  };

  // Safe camera stopper
  const stopCamera = async () => {
    if (html5QrCodeRef.current && isScannerRunningRef.current) {
      try {
        isScannerRunningRef.current = false;
        await html5QrCodeRef.current.stop();
      } catch (err) {
        // Safe catch
      }
    }
  };

  const startCamera = async (cameraConfig: string | MediaTrackConstraints) => {
    try {
      setCameraError(null);
      setIsCameraStarting(true);

      await stopCamera();

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(containerId);
      }

      const qrCode = html5QrCodeRef.current;

      // Fast, high-responsiveness scanner configuration
      const config = {
        fps: 25, // High frame rate for instant recognition
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.max(180, Math.floor(minEdge * 0.78));
          return { width: boxSize, height: boxSize };
        },
        aspectRatio: 1.0,
      };

      await qrCode.start(
        cameraConfig,
        config,
        (decodedText: string) => {
          handleSuccess(decodedText);
        },
        (errorMessage: string) => {
          if (onScanError) onScanError(errorMessage);
        }
      );

      isScannerRunningRef.current = true;
      setIsCameraStarting(false);
      setNoCameraHardware(false);

      // Check torch capability safely
      try {
        const capabilities: any = qrCode.getRunningTrackCameraCapabilities();
        if (capabilities && capabilities.torchFeature && capabilities.torchFeature.isSupported()) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
        }
      } catch (e) {
        setTorchSupported(false);
      }
    } catch (err: any) {
      isScannerRunningRef.current = false;
      setIsCameraStarting(false);

      const errName = err?.name || "";
      const errMsg = err?.message || String(err);

      if (errName === "NotFoundError" || errMsg.includes("NotFoundError") || errMsg.includes("not found") || errMsg.includes("DevicesNotFoundError")) {
        setNoCameraHardware(true);
        setCameraError("No physical camera detected on this device. You can upload or drop an image of the Office QR Code.");
        setActiveTab('file');
      } else if (errName === "NotAllowedError" || errMsg.includes("Permission") || errMsg.includes("NotAllowedError") || errMsg.includes("denied")) {
        setCameraError("Camera permission denied. Please allow camera access in browser settings, or use the 'Upload Image' tab below.");
      } else {
        setCameraError("Unable to start live camera stream. You can upload or drop an image of the Office QR Code instead.");
      }
    }
  };

  // Launch camera quickly on mount
  useEffect(() => {
    let isMounted = true;
    hasScannedRef.current = false;

    const initScanner = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!isMounted) return;
        setNoCameraHardware(true);
        setCameraError("Camera API is not supported on this browser. Switched to Image Upload mode.");
        setActiveTab('file');
        return;
      }

      try {
        setCameraError(null);
        setIsCameraStarting(true);

        // Fast launch: Try environment camera directly without waiting for slow enumeration
        await startCamera({ facingMode: "environment" });

        // Concurrently discover other cameras in the background
        Html5Qrcode.getCameras().then((devices) => {
          if (isMounted && devices && devices.length > 0) {
            setCameras(devices);
          }
        }).catch(() => {});
      } catch (err: any) {
        if (!isMounted) return;
        const errName = err?.name || "";
        const errMsg = err?.message || String(err);

        if (errName === "NotFoundError" || errMsg.includes("NotFoundError") || errMsg.includes("not found")) {
          setNoCameraHardware(true);
          setCameraError("No camera hardware detected. Switched to Image Upload mode.");
          setActiveTab('file');
        } else {
          try {
            await startCamera({ facingMode: "user" });
          } catch (e) {
            setNoCameraHardware(true);
            setActiveTab('file');
          }
        }
      }
    };

    if (activeTab === 'camera') {
      initScanner();
    }

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [activeTab]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScannerRunningRef.current) return;
    try {
      const nextState = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any]
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn("Torch toggle failed:", err);
    }
  };

  // Switch camera
  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamId = cameras[nextIndex].id;
    setSelectedCameraId(nextCamId);
    await startCamera(nextCamId);
  };

  // Instant File-based QR Code Scan
  const handleFileScan = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFileError("Please select a valid image file (.png, .jpg, .jpeg, .webp, .svg)");
      return;
    }

    setFileError(null);
    setIsDecodingFile(true);

    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      await stopCamera();

      const fileDecoder = new Html5Qrcode("file-qr-temp-node", false);
      const decodedText = await fileDecoder.scanFile(file, false);
      fileDecoder.clear();

      if (decodedText) {
        setIsDecodingFile(false);
        handleSuccess(decodedText);
      } else {
        setIsDecodingFile(false);
        setFileError("No QR Code detected in this image. Please ensure the QR code is centered, well-lit, and clearly visible.");
      }
    } catch (err: any) {
      setIsDecodingFile(false);
      setFileError("Could not decode a valid Office QR Code from this image. Please upload a clear photo or screenshot of the Office QR poster.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileScan(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      id="qr-scanner-modal" 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden temp DOM node for file scans */}
        <div id="file-qr-temp-node" className="hidden"></div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">Verify Office Attendance</h3>
              <p className="text-[11px] text-slate-500 font-medium">Fast QR & GPS Verification</p>
            </div>
          </div>
          <button 
            id="close-qr-scanner-btn"
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
            aria-label="Close QR Scanner"
          >
            <X size={18} />
          </button>
        </div>

        {/* Working Day vs Non-Working Day Status Banner */}
        {workStatus && (
          <div className={`px-4 py-2 border-b text-xs flex items-center justify-between gap-2 ${
            workStatus.isWorkingDay
              ? 'bg-emerald-50 text-emerald-900 border-emerald-100'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                workStatus.isWorkingDay ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`} />
              <span className="font-extrabold uppercase text-[10px] tracking-wider shrink-0">
                {workStatus.isWorkingDay ? 'Working Day' : 'Non-Working Day'}
              </span>
              <span className="text-slate-400">·</span>
              <span className="truncate text-[11px] font-medium text-slate-700">
                {workStatus.label}
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
              workStatus.isWorkingDay
                ? 'bg-emerald-100/90 text-emerald-800'
                : 'bg-amber-200/80 text-amber-900'
            }`}>
              {workStatus.isWorkingDay ? 'Regular Shift' : 'Overtime Log'}
            </span>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="p-3 bg-slate-100/70 border-b border-slate-200/60 flex gap-2">
          <button
            id="tab-camera-scan"
            type="button"
            onClick={() => {
              setActiveTab('camera');
              setFileError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <Camera size={14} />
            <span>Scan with Camera</span>
          </button>
          <button
            id="tab-file-scan"
            type="button"
            onClick={async () => {
              await stopCamera();
              setActiveTab('file');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'file'
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <UploadCloud size={14} />
            <span>Upload / Drop Image</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {noCameraHardware && activeTab === 'file' && (
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2 text-amber-800 text-xs leading-relaxed">
              <Info size={15} className="shrink-0 mt-0.5 text-amber-600" />
              <p>
                No physical camera hardware detected on this device. You can upload or drop an image of the Office QR Code.
              </p>
            </div>
          )}

          {activeTab === 'camera' ? (
            <div className="space-y-3">
              {/* Live Camera Viewfinder */}
              <div className="relative w-full aspect-square max-h-[300px] rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800 shadow-inner">
                <div id={containerId} className="w-full h-full object-cover"></div>

                {isCameraStarting && (
                  <div className="absolute inset-0 z-10 bg-slate-950 flex flex-col items-center justify-center gap-2 text-white p-4">
                    <Loader2 size={28} className="animate-spin text-blue-400" />
                    <p className="text-xs font-medium text-slate-300">Starting scanner camera...</p>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 z-20 bg-slate-900/95 flex flex-col items-center justify-center p-5 text-center text-white space-y-3">
                    <AlertCircle size={32} className="text-amber-400" />
                    <p className="text-xs text-slate-300 leading-relaxed max-w-xs">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('file')}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Switch to Image Upload
                    </button>
                  </div>
                )}

                {/* Reticle guide */}
                {!isCameraStarting && !cameraError && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-56 border-2 border-blue-400/60 rounded-2xl relative">
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-blue-500 rounded-tl-md"></div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-blue-500 rounded-tr-md"></div>
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-blue-500 rounded-bl-md"></div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-blue-500 rounded-br-md"></div>
                      
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                    </div>
                  </div>
                )}

                {/* Torch and Flip Controls */}
                {!isCameraStarting && !cameraError && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                    {torchSupported ? (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`p-2 rounded-xl text-xs font-bold backdrop-blur-md transition cursor-pointer flex items-center gap-1.5 ${
                          isTorchOn 
                            ? 'bg-amber-400 text-slate-950 font-bold' 
                            : 'bg-black/60 text-white hover:bg-black/80'
                        }`}
                        title="Toggle Flashlight"
                      >
                        {isTorchOn ? <Zap size={14} /> : <ZapOff size={14} />}
                        <span className="text-[10px]">{isTorchOn ? "Flash On" : "Flash"}</span>
                      </button>
                    ) : <div></div>}

                    {cameras.length > 1 && (
                      <button
                        type="button"
                        onClick={switchCamera}
                        className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl text-xs font-bold backdrop-blur-md transition cursor-pointer flex items-center gap-1.5"
                        title="Flip Camera"
                      >
                        <RotateCw size={14} />
                        <span className="text-[10px]">Switch</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* File Upload & Drop Zone */
            <div className="space-y-3">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full min-h-[220px] rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center transition cursor-pointer ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-50/80 scale-[1.01]' 
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/bmp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileScan(e.target.files[0]);
                    }
                  }}
                />

                {isDecodingFile ? (
                  <div className="space-y-2">
                    <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-800">Decoding QR Code instantly...</p>
                    <p className="text-[11px] text-slate-500">Verifying cryptographic token</p>
                  </div>
                ) : filePreview ? (
                  <div className="space-y-2.5">
                    <div className="w-20 h-20 mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                      <img src={filePreview} alt="QR Preview" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Image Loaded</p>
                    <p className="text-[11px] text-blue-600 font-semibold underline">Click or drop another file to change</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center mx-auto">
                      <UploadCloud size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Drop an image containing the Office QR</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">or click to browse from device photos</p>
                    </div>
                    <span className="inline-block px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-500">
                      PNG, JPG, WEBP, SVG
                    </span>
                  </div>
                )}
              </div>

              {fileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs leading-relaxed">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <p>{fileError}</p>
                </div>
              )}
            </div>
          )}

          {/* GPS & Verification Context Badge */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-100 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900">
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="text-blue-600" />
                Simultaneous GPS Pairing
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-bold inline-flex items-center gap-1">
                <CheckCircle2 size={11} />
                {gpsInfo?.accuracy ? `±${gpsInfo.accuracy.toFixed(0)}m Ready` : "Acquiring Fix..."}
              </span>
            </div>
            <p className="text-[11px] text-blue-800/90 font-normal leading-relaxed">
              Aim camera at the physical Office QR Code standee/poster or upload an image. Your GPS coordinates are verified simultaneously with the workspace QR token.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
