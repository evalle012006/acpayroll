import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import "../styles/Chat.css";

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

export default function Chat() {
  const currentUser = useMemo(() => readUser(), []);
  const bottomRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);

  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");

  const displayName = (row) => {
    if (row?.is_group) {
      return row?.group_name || row?.title || row?.department || "Department Group";
    }

    return (
      row?.other_full_name ||
      row?.full_name ||
      row?.username ||
      row?.other_username ||
      "User"
    );
  };

  const loadContacts = useCallback(async () => {
    try {
      const res = await api.get("/chat/contacts");
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get("/chat/conversations");
      setConversations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadMessages = useCallback(
    async (conversationId) => {
      if (!conversationId) return;

      try {
        const res = await api.get(`/chat/conversations/${conversationId}/messages`);
        setMessages(Array.isArray(res.data) ? res.data : []);
        await loadConversations();
      } catch (err) {
        console.error(err);
      }
    },
    [loadConversations]
  );

  useEffect(() => {
    loadContacts();
    loadConversations();
  }, [loadContacts, loadConversations]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadConversations();

      if (selected?.id) {
        loadMessages(selected.id);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [selected?.id, loadConversations, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return contacts;

    return contacts.filter((c) =>
      [c.full_name, c.username, c.role, c.department, c.area, c.region, c.division]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [contacts, search]);

  const openConversation = async (row) => {
    setSelected(row);
    await loadMessages(row.id);
  };

  const startChat = async (user) => {
    try {
      const res = await api.post("/chat/conversations/open", {
        user_id: user.id,
      });

      const conv = res.data;

      setSelected(conv);

      await loadConversations();
      await loadMessages(conv.id);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to start conversation.");
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFileName("");

    const input = document.getElementById("chat-file-input");
    if (input) input.value = "";
  };

  const sendMessage = async () => {
    if (!selected?.id) return;

    if (!message.trim() && !selectedFile) return;

    if (sending) return;

    try {
      setSending(true);

      const fd = new FormData();

      fd.append("message", message.trim());

      if (selectedFile) {
        fd.append("photo", selectedFile);
        fd.append("file_name", fileName || selectedFile.name);
      }

      await api.post(`/chat/conversations/${selected.id}/messages`, fd, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("");
      clearSelectedFile();

      await loadMessages(selected.id);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const downloadAttachment = async (file) => {
    try {
      const res = await api.get(`/chat/attachments/${file.id}/download`);

      if (res.data?.url) {
        window.open(res.data.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      alert(err?.response?.data?.message || "Unable to download file.");
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-sidebar">
        <div className="chat-sidebar-head">
          <h2>Messages</h2>
          <p>Messenger-style HRIPS chat</p>
        </div>

        <div className="chat-search">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="chat-section-title">Recent Chats</div>

        {conversations.length === 0 ? (
          <div className="chat-empty-small">No recent chats.</div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              className={`chat-item ${selected?.id === c.id ? "active" : ""}`}
              onClick={() => openConversation(c)}
              type="button"
            >
              <div className="chat-avatar">
                {displayName(c).charAt(0).toUpperCase()}
              </div>

              <div className="chat-item-body">
                <div className="chat-item-top">
                  <div className="chat-item-title">{displayName(c)}</div>

                  {Number(c.unread_count) > 0 && (
                    <span className="chat-badge">{c.unread_count}</span>
                  )}
                </div>

                <div className="chat-item-preview">
                  {c.last_message || (c.is_group ? "Department group chat" : "No messages yet")}
                </div>
              </div>
            </button>
          ))
        )}

        <div className="chat-section-title">Start New Chat</div>

        {filteredContacts.length === 0 ? (
          <div className="chat-empty-small">No users found.</div>
        ) : (
          filteredContacts.map((u) => (
            <button
              key={u.id}
              className="chat-item"
              onClick={() => startChat(u)}
              type="button"
            >
              <div className="chat-avatar">
                {displayName(u).charAt(0).toUpperCase()}
              </div>

              <div className="chat-item-body">
                <div className="chat-item-title">{displayName(u)}</div>

                <div className="chat-item-preview">
                  {[u.role, u.department].filter(Boolean).join(" • ")}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="chat-main">
        <div className="chat-header">
          {selected ? (
            <>
              <div className="chat-header-avatar">
                {displayName(selected).charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="chat-header-title">{displayName(selected)}</div>

                <div className="chat-header-subtitle">
                  {selected?.is_group
                    ? "Department Group Chat"
                    : selected.other_role || selected.role || "Private Chat"}
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="chat-header-title">Select a conversation</div>
              <div className="chat-header-subtitle">
                Choose a user or department group to start chatting.
              </div>
            </div>
          )}
        </div>

        <div className="chat-messages">
          {!selected ? (
            <div className="chat-empty">Select a conversation.</div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">No messages yet.</div>
          ) : (
            messages.map((m) => {
              const mine = Number(m.sender_id) === Number(currentUser.id);
              const hasText = String(m.message || "").trim();
              const attachments = Array.isArray(m.attachments) ? m.attachments : [];

              return (
                <div
                  key={m.id}
                  className={`chat-message-row ${mine ? "mine" : "theirs"}`}
                >
                  <div className={`chat-message ${mine ? "sent" : "received"}`}>
                    {hasText ? <div>{m.message}</div> : null}

                    {attachments.length > 0 && (
                      <div className="chat-files">
                        {attachments.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className="chat-file-btn"
                            onClick={() => downloadAttachment(f)}
                          >
                            📎 {f.file_name || f.original_name || "Attachment"}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="chat-time">
                      {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div ref={bottomRef} />
        </div>

        {selected && (
          <div className="chat-input">
            <label className="chat-upload-btn" title="Attach file">
              📎
              <input
                id="chat-file-input"
                type="file"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (!file) return;

                  setSelectedFile(file);
                  setFileName(file.name);
                }}
              />
            </label>

            {selectedFile && (
              <div className="chat-file-preview">
                <input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Rename file"
                />

                <button type="button" onClick={clearSelectedFile}>
                  ✕
                </button>
              </div>
            )}

            <input
              value={message}
              placeholder={selectedFile ? "Add a message..." : "Type a message..."}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
            />

            <button onClick={sendMessage} disabled={sending} type="button">
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}