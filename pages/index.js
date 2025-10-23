export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Captcha Solver Project</h1>
      <p>Your deployment is live!</p>
    </div>
  );
}
// pages/index.js
import { useState } from "react";

export default function Home() {
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [solvedText, setSolvedText] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    // Placeholder for solver logic
    setSolvedText("SolvedCaptcha123");
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>TDS Captcha Solver</h1>
      <p>Enter a captcha URL below to test the solver.</p>
      <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <input
          type="text"
          value={captchaUrl}
          onChange={(e) => setCaptchaUrl(e.target.value)}
          placeholder="https://example.com/sample.png"
          style={{
            width: "60%",
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "5px"
          }}
        />
        <button
          type="submit"
          style={{
            marginLeft: "10px",
            padding: "8px 16px",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          Solve
        </button>
      </form>

      {captchaUrl && (
        <div style={{ marginTop: "2rem" }}>
          <img src={captchaUrl} alt="Captcha" style={{ maxWidth: "400px" }} />
          <p><strong>Solved Text:</strong> {solvedText}</p>
        </div>
      )}
    </div>
  );
}
