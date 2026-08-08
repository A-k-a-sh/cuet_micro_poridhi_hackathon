import { QRCodeSVG } from 'qrcode.react';

export default function QRCode({ value, size = 180 }) {
  return (
    <div className="p-4 bg-white rounded-2xl inline-block shadow-xl shadow-black/50 border border-white/20">
      <QRCodeSVG
        value={value || 'CINEMASEAT-TICKET-INVALID'}
        size={size}
        level="H"
        includeMargin={true}
      />
    </div>
  );
}
