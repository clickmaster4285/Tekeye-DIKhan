declare module "qrcode" {
  export interface QRCodeToDataURLOptions {
    width?: number
    margin?: number
    color?: { dark?: string; light?: string }
    errorCorrectionLevel?: "L" | "M" | "Q" | "H"
  }
  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions
  ): Promise<string>
  const QRCode: {
    toDataURL: typeof toDataURL
  }
  export default QRCode
}
