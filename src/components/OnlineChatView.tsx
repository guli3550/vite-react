import { useState, useEffect, useRef, FormEvent } from "react";
import { type Language, getTranslation } from "../utils/translations";
import {
  type ChatMessage,
  getStoredChatMessages,
  sendUserMessage,
  markMessagesAsRead,
  subscribeToChat,
  toggleMessageReaction,
} from "../utils/chatSync";
import { SwipeableChatBackground, SwipeableMessageRow } from "./SwipeChatHelpers";

const REACTION_EMOJIS = ["❤️", "👍", "🔥", "😂", "😮", "🙏"];

type OnlineChatViewProps = {
  language: Language;
  onBack: () => void;
  user?: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
  onShowToast?: (msg: string) => void;
};

export function OnlineChatView({
  language,
  onBack,
  user,
  onShowToast,
}: OnlineChatViewProps) {
  const t = (key: any) => getTranslation(key, language);
  const userId = user?.id ? String(user.id) : "guest-user";
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getStoredChatMessages(userId)
  );
  const [inputText, setInputText] = useState("");
  const [replyingToMsg, setReplyingToMsg] = useState<ChatMessage | null>(null);
  const [activeLongPressMsgId, setActiveLongPressMsgId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const longPressTimerRef = useRef<any>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const showToast = (msgStr: string) => {
    if (onShowToast) onShowToast(msgStr);
    setToastMsg(msgStr);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleStartHold = (msg: ChatMessage) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
      } catch {}
      setActiveLongPressMsgId(msg.id);
    }, 700);
  };

  const handleCancelHold = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCopyText = (textToCopy: string) => {
    if (!textToCopy) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error("Copy failed", err);
    }

    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}

    showToast("Matn nusxalandi 📋");
    setActiveLongPressMsgId(null);
  };

  // Global click outside listener to dismiss long press popover
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".chatLongPressMenuWrap") && !target.closest(".bubbleBox")) {
        setActiveLongPressMsgId(null);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("touchstart", handleOutsideClick);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("touchstart", handleOutsideClick);
    };
  }, []);
  const [recordTimer, setRecordTimer] = useState(0);
  const timerIntervalRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Mark all messages as read when user enters chat
  useEffect(() => {
    markMessagesAsRead(userId);
  }, [userId]);

  // Subscribe to live chat sync
  useEffect(() => {
    const unsubscribe = subscribeToChat((all) => {
      const filtered = all.filter(
        (m) =>
          !m.userId ||
          String(m.userId) === String(userId) ||
          m.id === "welcome-msg-1"
      );
      setMessages(filtered);
      markMessagesAsRead(userId);
    });
    return unsubscribe;
  }, [userId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e?: FormEvent, customText?: string, media?: { type?: "image" | "file" | "audio"; mediaUrl?: string; fileName?: string }) => {
    if (e) e.preventDefault();
    const textToSend = (customText || inputText).trim();
    if (!textToSend && !media) return;

    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
      }
    } catch {}

    const replyParam = replyingToMsg
      ? {
          id: replyingToMsg.id,
          text: replyingToMsg.text || (replyingToMsg.type === "image" ? "📷 Rasm" : "📁 Fayl"),
          sender: replyingToMsg.sender === "admin" ? t("admin_tag") : t("you_tag"),
        }
      : undefined;

    sendUserMessage(
      textToSend || (media?.type === "image" ? "📷 Rasm" : media?.type === "audio" ? "🎙️ Ovozli xabar" : "📁 Fayl"),
      user,
      media,
      replyParam
    );

    setInputText("");
    setReplyingToMsg(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      handleSendMessage(undefined, "📷 Rasm", { type: "image", mediaUrl: base64, fileName: file.name });
      onShowToast?.("Rasm yuborildi ✓");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      handleSendMessage(undefined, `📁 ${file.name}`, { type: "file", mediaUrl: base64, fileName: file.name });
      onShowToast?.("Fayl yuborildi ✓");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          handleSendMessage(undefined, "🎙️ Ovozli xabar", { type: "audio", mediaUrl: base64Audio, fileName: "voice.webm" });
          onShowToast?.("Ovozli xabar yuborildi ✓");
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordTimer((prev) => prev + 1);
      }, 1000);

      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
      } catch {}
    } catch {
      onShowToast?.("Mikrofondan foydalanishga ruxsat berilmadi");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
      setRecordTimer(0);
    }
  };

  const formatMessageTime = (isoString: string) => {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const quickQuestions = [
    t("quick_q1"),
    t("quick_q2"),
    t("quick_q3"),
    t("quick_q4"),
  ];

  return (
    <SwipeableChatBackground onExit={onBack} id="online-chat-view-swipe-wrap">
      <div className="chatPageContainer" id="online-chat-view">
        {/* Hidden inputs */}
        <input
          type="file"
          ref={imageInputRef}
          style={{ display: "none" }}
          accept="image/*"
          onChange={handleImageSelect}
        />
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />

        {/* Chat Topbar */}
        <header className="chatHeader">
          <button
            type="button"
            className="chatBackBtn"
            onClick={onBack}
            id="chat-back-btn"
            aria-label={t("back")}
          >
            ←
          </button>

          <div className="chatHeaderInfo">
            <div className="chatSupportAvatar">
              <img src="/guli_logo.jpg" alt="Guli Support" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              <span className="onlineDot" />
            </div>
            <div>
              <b>{t("chat_welcome_title")}</b>
              <small className="chatOnlineLabel">{t("online_status")}</small>
            </div>
          </div>

          <a
            href="tel:+998905811117"
            className="chatCallShortcutBtn"
            title="Call Center: +998905811117"
            id="chat-header-call-btn"
          >
            📞
          </a>
        </header>

        {/* Messages Scroll Area */}
        <div
          className="chatMessagesArea"
          id="chat-messages-scroll"
          style={{ position: "relative", userSelect: "none", WebkitUserSelect: "none" }}
        >
          {toastMsg && (
            <div className="chatToastAlert">
              <span>{toastMsg}</span>
            </div>
          )}

          <div className="chatNoticePill">
            <span>🔒 {t("online_chat_desc")} · Xabarni surib javob berish, uzoq bosib reaksiya va nusxalash</span>
          </div>

          {messages
            .filter((m) => Boolean((m.text && m.text.trim()) || m.mediaUrl || m.pollOptions || m.location))
            .map((msg, index) => {
            const isAdmin = msg.sender === "admin";
            const align = isAdmin ? "left" : "right";
            const isLongPressActive = activeLongPressMsgId === msg.id;
            const isTopMessage = index === 0;

            const handleToggleReaction = (emoji: string) => {
              try {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
              } catch {}
              toggleMessageReaction(msg.id, emoji);
              setActiveLongPressMsgId(null);
            };

            return (
              <SwipeableMessageRow
                key={msg.id || index}
                align={align}
                onReply={() => setReplyingToMsg(msg)}
                id={`swipe-msg-row-${msg.id || index}`}
              >
                <div
                  className={`chatBubbleRow ${isAdmin ? "fromAdmin" : "fromUser"} ${isLongPressActive ? "activeLongPressBubbleRow" : ""}`}
                  id={`chat-bubble-${msg.id || index}`}
                  style={{ position: "relative", userSelect: "none", WebkitUserSelect: "none" }}
                >
                  {isAdmin && (
                    <div className="bubbleAvatar adminAvatar">
                      <img src="/guli_logo.jpg" alt="Guli Admin" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    </div>
                  )}

                  <div className="bubbleContentWrap" style={{ position: "relative" }}>
                    <div className="bubbleSenderName">
                      <span>{isAdmin ? t("admin_tag") : t("you_tag")}</span>
                    </div>

                    {/* Long Press Floating Reaction Emojis Bar (Optimized & clamped within view) */}
                    {isLongPressActive && (
                      <div
                        className={`chatLongPressReactionsBar ${isTopMessage ? "renderBelowBubble" : "renderAboveBubble"}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="chatReactionEmojiBtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleReaction(emoji);
                            }}
                            title={`Reaksiya: ${emoji}`}
                          >
                            <span>{emoji}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div
                      className={`bubbleBox ${isLongPressActive ? "activeBubbleBox" : ""}`}
                      onTouchStart={(e) => {
                        touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                        handleStartHold(msg);
                      }}
                      onTouchMove={(e) => {
                        if (touchStartPosRef.current) {
                          const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
                          const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
                          if (dx > 8 || dy > 8) {
                            handleCancelHold();
                          }
                        }
                      }}
                      onTouchEnd={handleCancelHold}
                      onMouseDown={() => handleStartHold(msg)}
                      onMouseMove={(e) => {
                        if (e.buttons === 1) {
                          handleCancelHold();
                        }
                      }}
                      onMouseUp={handleCancelHold}
                      onMouseLeave={handleCancelHold}
                      style={{ cursor: "pointer", position: "relative", userSelect: "none", WebkitUserSelect: "none" }}
                    >
                      {/* Quoted Reply snippet */}
                      {msg.replyToText && (
                        <div className="chatQuoteSnippet">
                          <span className="quoteSender">{msg.replyToSender || "Javob"}:</span>
                          <span className="quoteText">{msg.replyToText}</span>
                        </div>
                      )}

                      {msg.type === "image" && msg.mediaUrl ? (
                        <div className="chatMediaImage">
                          <img src={msg.mediaUrl} alt="Uploaded attachment" />
                          {msg.text && msg.text !== "📷 Rasm" && <p className="bubbleText">{msg.text}</p>}
                        </div>
                      ) : msg.type === "audio" && msg.mediaUrl ? (
                        <div className="chatMediaAudio">
                          <audio controls src={msg.mediaUrl} style={{ width: "100%", maxHeight: "40px" }} />
                          <span className="audioLabel">🎙️ Ovozli xabar</span>
                        </div>
                      ) : msg.type === "file" && msg.mediaUrl ? (
                        <div className="chatMediaFile">
                          <a href={msg.mediaUrl} download={msg.fileName || "file"} className="fileDownloadLink">
                            📁 {msg.fileName || "Hujjatni yuklab olish"}
                          </a>
                        </div>
                      ) : (
                        <p className="bubbleText">{msg.text}</p>
                      )}

                      {/* Active Reaction Pills inside the message bubble */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="chatReactionPillsRow insideBubble">
                          {Object.entries(msg.reactions).map(([emoji, count]) => (
                            <button
                              key={emoji}
                              type="button"
                              className="chatReactionPill insideBubble"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleReaction(emoji);
                              }}
                              title={`Reaksiya: ${emoji} (${count})`}
                            >
                              <span>{emoji}</span>
                              <span className="reactionCount">{count}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <span className="bubbleTime">
                        {formatMessageTime(msg.timestamp)}
                        {!isAdmin && (
                          <span className="readCheck">
                            {msg.read ? " ✓✓" : " ✓"}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Separate Small Copy Button (Appears cleanly below message on long press) */}
                    {isLongPressActive && (
                      <div className={`chatCopyBtnSeparate ${isAdmin ? "afterAdminBubble" : "afterUserBubble"}`} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="chatSmallCopyBtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyText(msg.text || "");
                          }}
                        >
                          <span>📋</span>
                          <span>Matnni nusxalash</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {!isAdmin && (
                    <div className="bubbleAvatar userAvatar">
                      {user?.photo_url ? (
                        <img src={user.photo_url} alt="Profile" />
                      ) : (
                        <span>{(user?.first_name || "M").slice(0, 1)}</span>
                      )}
                    </div>
                  )}
                </div>
              </SwipeableMessageRow>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="chatQuickChipsScroll">
          {quickQuestions.map((q, i) => (
            <button
              key={i}
              type="button"
              className="quickChipBtn"
              onClick={() => handleSendMessage(undefined, q)}
              id={`quick-chip-${i}`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Recording status bar if recording */}
        {isRecording && (
          <div className="recordingStatusBar">
            <span className="pulsingDot" />
            <span>Ovoz yozilmoqda... 0:</span>
            <span>{recordTimer < 10 ? `0${recordTimer}` : recordTimer}</span>
            <button type="button" className="stopRecordBtn" onClick={stopRecording}>
              Tugatish va yuborish ✓
            </button>
          </div>
        )}

        {/* Reply Preview Bar */}
        {replyingToMsg && (
          <div className="chatReplyPreviewBar">
            <div className="chatReplyPreviewContent">
              <span className="replyIcon">↩️</span>
              <div className="replyTextInfo">
                <b>{replyingToMsg.sender === "admin" ? t("admin_tag") : (replyingToMsg.userName || t("you_tag"))}</b>
                <p>{replyingToMsg.text || (replyingToMsg.type === "image" ? "📷 Rasm" : "📁 Fayl")}</p>
              </div>
            </div>
            <button
              type="button"
              className="closeReplyBtn"
              onClick={() => setReplyingToMsg(null)}
              title="Javobni bekor qilish"
            >
              ✕
            </button>
          </div>
        )}

        {/* Message Input Box */}
        <form
          className="chatInputBar"
          onSubmit={(e) => handleSendMessage(e)}
          id="chat-message-form"
        >
          <button
            type="button"
            className="chatAttachBtn"
            onClick={() => imageInputRef.current?.click()}
            title="Rasm yuborish"
            id="chat-img-btn"
          >
            📷
          </button>
          <button
            type="button"
            className="chatAttachBtn"
            onClick={() => fileInputRef.current?.click()}
            title="Fayl yuborish"
            id="chat-file-btn"
          >
            📎
          </button>
          <button
            type="button"
            className={`chatAttachBtn ${isRecording ? "recordingActive" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? "Ovoz yozishni to'xtatish" : "Ovozli xabar yuborish"}
            id="chat-mic-btn"
          >
            🎙️
          </button>

          <input
            type="text"
            className="chatInputField"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={replyingToMsg ? "Javob yozing..." : t("type_message")}
            id="chat-input-text"
          />
          <button
            type="submit"
            className="chatSendBtn"
            disabled={!inputText.trim()}
            id="chat-send-button"
            aria-label={t("send")}
          >
            ➤
          </button>
        </form>
      </div>
    </SwipeableChatBackground>
  );
}
