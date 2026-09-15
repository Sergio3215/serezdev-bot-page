import { ImageResponse } from "next/og";

export const alt = "Serez Dev Bot - Personaliza y Configura tu Servidor de Discord";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0b10",
          backgroundImage:
            "radial-gradient(circle at 50% 20%, rgba(88, 101, 242, 0.22) 0%, rgba(10, 11, 16, 0.95) 70%)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "60px 80px",
          position: "relative",
        }}
      >
        {/* Discord Bot Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "rgba(88, 101, 242, 0.15)",
            border: "1px solid rgba(88, 101, 242, 0.35)",
            borderRadius: "9999px",
            padding: "8px 24px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "9999px",
              backgroundColor: "#5865F2",
            }}
          />
          <span
            style={{
              color: "#8a94f8",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Panel Web Oficial de Discord
          </span>
        </div>

        {/* Main Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: "64px",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textAlign: "center",
            marginBottom: "16px",
            background: "linear-gradient(to right, #ffffff, #e4e4e7, #a1a1aa)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Serez Dev Bot
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: "26px",
            fontWeight: 500,
            color: "#a1a1aa",
            textAlign: "center",
            maxWidth: "850px",
            lineHeight: 1.4,
            marginBottom: "40px",
          }}
        >
          Personalización avanzada, configuración web intuitiva y herramientas de automatización para tu servidor de Discord.
        </div>

        {/* Feature Pills */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "14px",
              padding: "10px 20px",
              fontSize: "16px",
              color: "#e4e4e7",
              fontWeight: 600,
            }}
          >
            ⚡ Control desde la Web
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "14px",
              padding: "10px 20px",
              fontSize: "16px",
              color: "#e4e4e7",
              fontWeight: 600,
            }}
          >
            🛠️ Personalización
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "14px",
              padding: "10px 20px",
              fontSize: "16px",
              color: "#e4e4e7",
              fontWeight: 600,
            }}
          >
            👑 Opciones Premium
          </div>
        </div>

        {/* Footer URL */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            fontSize: "15px",
            color: "#71717a",
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          bot.serez.dev
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
