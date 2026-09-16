import React, { useRef, useState, useEffect } from "react";

interface CircleVideoNotePlayerProps {
  mediaUrl: string;
  duration?: number;
  size?: number;
  autoPlay?: boolean;
}

export const CircleVideoNotePlayer: React.FC<CircleVideoNotePlayerProps> = ({
  mediaUrl,
  size = 180,
  autoPlay = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  return (
    <div
      onClick={togglePlay}
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        overflow: "hidden",
        cursor: "pointer",
        backgroundColor: "#000",
        display: "inline-block",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      }}
    >
      <video
        ref={videoRef}
        src={mediaUrl}
        playsInline
        loop
        muted={false}
        autoPlay={autoPlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "50%",
        }}
      />
      {/* Play/Pause overlay */}
      {!isPlaying && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: `${size / 4}px`,
          }}
        >
          ▶
        </div>
      )}
      {/* Circular progress rim */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: "rotate(-90deg)",
          pointerEvents: "none",
        }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 3}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 3}
          fill="none"
          stroke="#229ED9"
          strokeWidth="3"
          strokeDasharray={Math.PI * (size - 6)}
          strokeDashoffset={Math.PI * (size - 6) * (1 - progress / 100)}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

interface TelegramCircularVideoRecorderOverlayProps {
  onCancel: () => void;
  onSend: (base64Video: string, durationSec: number) => void;
  onShowToast?: (msg: string) => void;
}

export const TelegramCircularVideoRecorderOverlay: React.FC<TelegramCircularVideoRecorderOverlayProps> = ({
  onCancel,
  onSend,
  onShowToast,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 480, height: 480 }, audio: true })
      .then((s) => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(() => {
        onShowToast?.("Kameraga ruxsat berilmadi.");
        onCancel();
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    let interval: number | null = null;
    if (isRecording) {
      interval = window.setInterval(() => {
        setTimer((t) => {
          if (t >= 60) {
            stopRecording();
            return 60;
          }
          return t + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const reader = new FileReader();
      reader.onloadend = () => {
        onSend(reader.result as string, timer);
      };
      reader.readAsDataURL(blob);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        backgroundColor: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          overflow: "hidden",
          border: "4px solid #229ED9",
          boxShadow: "0 0 30px rgba(34, 158, 217, 0.4)",
          backgroundColor: "#000",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)",
          }}
        />
        {isRecording && (
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "rgba(220, 38, 38, 0.8)",
              color: "#fff",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            ● 0:{timer < 10 ? `0${timer}` : timer}
          </div>
        )}
      </div>

      <div style={{ marginTop: "32px", display: "flex", gap: "16px", alignItems: "center" }}>
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            style={{
              padding: "14px 28px",
              borderRadius: "30px",
              backgroundColor: "#229ED9",
              color: "#fff",
              border: "none",
              fontSize: "15px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ● Yozishni boshlash
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            style={{
              padding: "14px 28px",
              borderRadius: "30px",
              backgroundColor: "#ef4444",
              color: "#fff",
              border: "none",
              fontSize: "15px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ■ To'xtatish va yuborish
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "14px 20px",
            borderRadius: "30px",
            backgroundColor: "rgba(255,255,255,0.15)",
            color: "#fff",
            border: "none",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Bekor qilish
        </button>
      </div>
    </div>
  );
};
