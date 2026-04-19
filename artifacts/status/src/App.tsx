export default function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: "#fff",
      padding: "24px",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "24px",
        padding: "48px 40px",
        maxWidth: "480px",
        width: "100%",
        textAlign: "center",
        backdropFilter: "blur(12px)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
      }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🛍️</div>

        <h1 style={{
          fontSize: "28px",
          fontWeight: "700",
          margin: "0 0 6px",
          letterSpacing: "-0.5px",
          background: "linear-gradient(135deg, #ffffff 0%, #a78bfa 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>NexoShop</h1>

        <p style={{
          color: "rgba(255,255,255,0.45)",
          fontSize: "13px",
          margin: "0 0 32px",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}>Bot Telegram • Digital Shop</p>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: "12px",
          padding: "14px 20px",
          marginBottom: "32px",
        }}>
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 8px #22c55e",
            animation: "pulse 2s infinite",
            flexShrink: 0,
          }} />
          <span style={{ color: "#86efac", fontSize: "14px", fontWeight: "600" }}>
            Bot en ligne — Opérationnel
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
          {[
            { emoji: "💳", label: "Abonnements", desc: "Netflix, PS+, Spotify, IPTV" },
            { emoji: "🏋️", label: "Sport", desc: "Basic Fit, Fitness Park" },
            { emoji: "🔧", label: "Méthodes", desc: "Techs & méthodes digitales" },
            { emoji: "💳", label: "Paiements", desc: "SumUp, Apple Pay, PayPal" },
          ].map((item, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "12px 16px",
              textAlign: "left",
            }}>
              <span style={{ fontSize: "20px" }}>{item.emoji}</span>
              <div>
                <div style={{ fontWeight: "600", fontSize: "14px", color: "#fff" }}>{item.label}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <a
          href="https://t.me/NexoShop69Bot"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
            color: "#fff",
            textDecoration: "none",
            padding: "14px 28px",
            borderRadius: "14px",
            fontWeight: "700",
            fontSize: "15px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
            transition: "opacity 0.15s",
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseOut={e => (e.currentTarget.style.opacity = "1")}
        >
          <span style={{ fontSize: "20px" }}>✈️</span>
          Accéder au Bot
        </a>

        <p style={{
          marginTop: "24px",
          color: "rgba(255,255,255,0.2)",
          fontSize: "11px",
        }}>
          © 2025 NexoShop — Tous droits réservés
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
