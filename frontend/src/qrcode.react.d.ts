declare module "qrcode.react" {
  import type { CSSProperties } from "react"

  export interface QRCodeSVGProps {
    value: string
    size?: number
    level?: "L" | "M" | "Q" | "H"
    bgColor?: string
    fgColor?: string
    style?: CSSProperties
    includeMargin?: boolean
  }

  export function QRCodeSVG(props: QRCodeSVGProps): JSX.Element
}
