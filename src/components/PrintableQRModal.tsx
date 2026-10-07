import React, { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { 
  Printer, 
  Download, 
  X, 
  Check, 
  ShieldCheck, 
  MapPin, 
  Wifi, 
  QrCode, 
  Smartphone, 
  Copy, 
  Sparkles,
  FileText,
  Building,
  Calendar,
  Layers
} from "lucide-react";
import { SiteSettings, OfficeQRCodeData } from "../types";

interface PrintableQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: OfficeQRCodeData | null;
  siteSettings: SiteSettings | null;
  workspaceName?: string;
}

export const PrintableQRModal: React.FC<PrintableQRModalProps> = ({
  isOpen,
  onClose,
  qrCode,
  siteSettings,
  workspaceName
}) => {
  const [posterStyle, setPosterStyle] = useState<"full_poster" | "desk_card" | "minimal">("full_poster");
  const [showWifiInfo, setShowWifiInfo] = useState<boolean>(true);
  const [showInstructions, setShowInstructions] = useState<boolean>(true);
  const [customNote, setCustomNote] = useState<string>("");
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const posterRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !qrCode) return null;

  const officeName = siteSettings?.office_name || workspaceName || "Apex Main Office";
  const wifiSsid = siteSettings?.office_wifi_ssid || siteSettings?.wifi_ssid || "Apex_HQ_WiFi";
  const qrId = qrCode.qr_id || qrCode.token_id || "OFFICE-QR-ACTIVE";
  const generatedDate = qrCode.created_at 
    ? new Date(qrCode.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPNG = () => {
    const svgElement = document.querySelector("#printable-qr-svg") as SVGElement;
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    // High resolution canvas for sharp printing
    canvas.width = 1200;
    canvas.height = 1200;

    img.onload = () => {
      if (ctx) {
        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw decorative subtle border
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 16;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

        // Office Name Title Header
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 56px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(officeName, canvas.width / 2, 140);

        // Subtitle
        ctx.fillStyle = "#64748b";
        ctx.font = "600 32px Inter, sans-serif";
        ctx.fillText("Official Attendance Check-In Point", canvas.width / 2, 200);

        // Draw QR Code
        ctx.drawImage(img, 200, 260, 800, 800);

        // Bottom ID Banner
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 34px 'JetBrains Mono', monospace";
        ctx.fillText(`QR ID: ${qrId}`, canvas.width / 2, 1120);

        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `Attendance-QR-Sign-${qrId}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleDownloadSVG = () => {
    const svgElement = document.querySelector("#printable-qr-svg") as SVGElement;
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.download = `Attendance-QR-Vector-${qrId}.svg`;
    downloadLink.href = url;
    downloadLink.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(qrId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 print:p-0 print:bg-white">
      {/* Modal Card */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Header (Hidden on print) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Printer size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Print Office QR Code Sign</h3>
              <p className="text-xs text-slate-500">Generate high-resolution printable posters & desk cards for attendance check-ins</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body: Controls & Live Printable Area */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 print:p-0 print:overflow-visible">
          
          {/* Controls Column (Hidden on print) */}
          <div className="lg:col-span-4 space-y-5 print:hidden">
            {/* Poster Format Switcher */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Poster Format
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setPosterStyle("full_poster")}
                  className={`px-3.5 py-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2.5 transition ${
                    posterStyle === "full_poster"
                      ? "bg-blue-50 border-blue-500 text-blue-800 shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <FileText size={16} className={posterStyle === "full_poster" ? "text-blue-600" : "text-slate-400"} />
                  <div>
                    <span className="font-bold block">A4 / Letter Wall Poster</span>
                    <span className="text-[10px] text-slate-400 font-normal">Standard entrance or reception poster</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPosterStyle("desk_card")}
                  className={`px-3.5 py-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2.5 transition ${
                    posterStyle === "desk_card"
                      ? "bg-blue-50 border-blue-500 text-blue-800 shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Building size={16} className={posterStyle === "desk_card" ? "text-blue-600" : "text-slate-400"} />
                  <div>
                    <span className="font-bold block">Desk Standee Card</span>
                    <span className="text-[10px] text-slate-400 font-normal">Compact format for acrylic table stands</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPosterStyle("minimal")}
                  className={`px-3.5 py-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2.5 transition ${
                    posterStyle === "minimal"
                      ? "bg-blue-50 border-blue-500 text-blue-800 shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <QrCode size={16} className={posterStyle === "minimal" ? "text-blue-600" : "text-slate-400"} />
                  <div>
                    <span className="font-bold block">Minimalist QR Sticker</span>
                    <span className="text-[10px] text-slate-400 font-normal">High contrast QR code only</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Customization Options */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Poster Elements
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWifiInfo}
                  onChange={(e) => setShowWifiInfo(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Include Office Wi-Fi details
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInstructions}
                  onChange={(e) => setShowInstructions(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Include 3-step Employee Guide
              </label>

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-slate-500 block">
                  Custom Poster Footer Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Please check in before 08:30 AM"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Printer size={16} /> Print Official Poster (Ctrl+P)
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPNG}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} /> Download PNG
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSVG}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} /> Vector SVG
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="w-full py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {isCopied ? "Identifier Copied!" : "Copy Office QR Identifier"}
              </button>
            </div>
          </div>

          {/* Printable Preview Area */}
          <div className="lg:col-span-8 flex flex-col items-center justify-center bg-slate-100/70 p-4 sm:p-6 rounded-2xl border border-slate-200/60 print:bg-white print:border-none print:p-0">
            
            {/* The Actual Printable Poster Box (Rendered on paper and preview) */}
            <div
              id="printable-qr-poster"
              ref={posterRef}
              className={`bg-white text-slate-900 rounded-2xl border-2 border-slate-800 shadow-xl overflow-hidden flex flex-col items-center text-center transition-all mx-auto print:border-2 print:border-black print:shadow-none print:rounded-none ${
                posterStyle === "full_poster"
                  ? "w-full max-w-[460px] p-8 space-y-6"
                  : posterStyle === "desk_card"
                  ? "w-full max-w-[380px] p-6 space-y-4"
                  : "w-full max-w-[320px] p-6 space-y-4"
              }`}
            >
              {/* Header Badge */}
              <div className="w-full border-b-2 border-slate-900 pb-4 space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-full text-[11px] font-bold tracking-wider uppercase mb-1">
                  <ShieldCheck size={14} className="text-blue-400" />
                  Official Attendance Point
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                  {officeName}
                </h1>
                <p className="text-xs font-semibold text-slate-600">
                  Daily Employee Check-In & Check-Out Verification
                </p>
              </div>

              {/* QR Code Container */}
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-900 shadow-inner flex flex-col items-center justify-center">
                <div className="p-2 bg-white">
                  <QRCodeSVG
                    id="printable-qr-svg"
                    value={qrCode.code || qrCode.qr_id || qrId}
                    size={posterStyle === "full_poster" ? 220 : posterStyle === "desk_card" ? 180 : 160}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="mt-2 text-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">
                    Office QR Identifier
                  </span>
                  <span className="text-xs font-mono font-black text-slate-900">
                    {qrId}
                  </span>
                </div>
              </div>

              {/* Instructions Section (if toggled) */}
              {showInstructions && posterStyle !== "minimal" && (
                <div className="w-full bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-left space-y-2">
                  <div className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1.5">
                    <Smartphone size={13} className="text-blue-600" />
                    How to Record Attendance:
                  </div>
                  <ol className="text-[11px] text-slate-700 font-medium space-y-1.5 list-decimal pl-4">
                    <li>Open the <strong>Attendance Mobile Portal</strong> on your smartphone.</li>
                   <li>Tap <strong>Check-In</strong> and align your camera with the QR code above.</li>
                  </ol>
                </div>
              )}

              {/* Wi-Fi & Geofence Notice (if toggled) */}
              {showWifiInfo && (
                <div className="w-full grid grid-cols-2 gap-2 text-left text-[10px]">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2">
                    <Wifi size={14} className="text-blue-600 shrink-0" />
                    <div>
                      <span className="text-slate-400 block font-bold">Office Wi-Fi:</span>
                      <span className="font-mono font-bold text-slate-800 truncate block">{wifiSsid}</span>
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2">
                    <MapPin size={14} className="text-rose-600 shrink-0" />
                    <div>
                      <span className="text-slate-400 block font-bold">Geofence:</span>
                      <span className="font-bold text-slate-800 block">Active Radius</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Optional Note */}
              {customNote && (
                <div className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-900">
                  {customNote}
                </div>
              )}

              {/* Poster Footer */}
              <div className="w-full pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <div className="flex items-center gap-1">
                  <Calendar size={11} />
                  <span>Valid from: {generatedDate}</span>
                </div>
                <div className="font-bold text-slate-800">
                  Nabi Tech Attendance System
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-4 print:hidden text-center">
              💡 Tip: Click <strong>"Print Official Poster"</strong> or press <strong>Ctrl+P</strong> to print directly. The preview matches high-resolution 300DPI output.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
