import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { AGENT_CONFIGS, Agent, AgentTask, AgentEvent, CAMERA_PRESETS, CameraPresetKey } from "./types";
import { buildOfficeScene, OfficeSceneHandles } from "./officeSceneBuilder";
import { buildAgentCharacter, AgentCharacter3D } from "./agentCharacter3d";

interface Props {
  agents: Agent[];
  tasks: AgentTask[];
  events: AgentEvent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  presetKey?: CameraPresetKey;
  onChangePreset?: (preset: CameraPresetKey) => void;
}

export const AgentOfficeCanvas: React.FC<Props> = ({
  agents,
  tasks,
  events,
  selectedAgentId,
  onSelectAgent,
  presetKey = "overview",
  onChangePreset,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [hasWebGlError, setHasWebGlError] = useState(false);
  const [isLiteMode, setIsLiteMode] = useState(false);

  // References to keep across re-renders
  const sceneHandlesRef = useRef<OfficeSceneHandles | null>(null);
  const charactersRef = useRef<Map<string, AgentCharacter3D>>(new Map());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Camera animation target states
  const targetCamPos = useRef(new THREE.Vector3(0, 14, 16));
  const targetLookAt = useRef(new THREE.Vector3(0, 1, 0));
  const currentLookAt = useRef(new THREE.Vector3(0, 1, 0));

  // Interaction dragging states
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const prevPointer = useRef({ x: 0, y: 0 });
  const touchStartDist = useRef(0);

  // Spherical orbit angles
  const spherical = useRef({
    radius: 21,
    theta: 0,
    phi: Math.PI * 0.28,
  });

  // Check WebGL availability
  const checkWebGL = useCallback(() => {
    try {
      if (typeof window === "undefined") return false;
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      return !!gl;
    } catch {
      return false;
    }
  }, []);

  // Sync agent status & tasks into 3D characters
  useEffect(() => {
    const chars = charactersRef.current;
    if (!chars.size) return;

    Object.values(AGENT_CONFIGS).forEach((cfg) => {
      const char = chars.get(cfg.id);
      if (!char) return;

      const agentData = agents.find((a) => a.id === cfg.id);
      const activeTasks = tasks.filter((t) => t.agent_id === cfg.id && ["queued", "running"].includes(t.status));
      const runningTask = activeTasks.find((t) => t.status === "running");
      const latestEvent = events.find((e) => e.agent_id === cfg.id);

      let status: "working" | "idle" | "thinking" | "error" = "idle";
      let taskName = "";

      if (runningTask) {
        status = "working";
        try {
          const parsed = JSON.parse(runningTask.command);
          taskName = parsed.type === "catalog_check" ? "Katalog tahlili" :
                     parsed.type === "order_lookup" ? "Buyurtma tekshiruvi" :
                     parsed.type === "payment_status" ? "To‘lov tekshiruvi" :
                     parsed.type === "chat_inspect" ? "Chat tekshiruvi" :
                     parsed.type === "security_audit" ? "Xavfsizlik auditi" : parsed.type;
        } catch {
          taskName = runningTask.command;
        }
      } else if (activeTasks.length > 0) {
        status = "thinking";
        taskName = "Navbatda kutilmoqda";
      } else if (agentData?.status === "working") {
        status = "working";
        taskName = "Operatsiya faol";
      } else if (latestEvent?.event_type === "task_failed") {
        status = "error";
        taskName = "Xatolik yuz berdi";
      }

      char.setStatus(status, taskName);
    });
  }, [agents, tasks, events]);

  // Handle camera presets or selected agent focus
  useEffect(() => {
    if (selectedAgentId && AGENT_CONFIGS[selectedAgentId]) {
      const cfg = AGENT_CONFIGS[selectedAgentId];
      // Focus camera on selected agent
      targetLookAt.current.set(cfg.deskPos[0], 1.2, cfg.deskPos[2]);
      targetCamPos.current.set(
        cfg.deskPos[0] + Math.sin(cfg.deskRotY) * 2.8,
        3.2,
        cfg.deskPos[2] + Math.cos(cfg.deskRotY) * 3.8
      );
    } else {
      const preset = CAMERA_PRESETS.find((p) => p.key === presetKey) || CAMERA_PRESETS[0];
      targetCamPos.current.set(...preset.position);
      targetLookAt.current.set(...preset.target);
    }
  }, [selectedAgentId, presetKey]);

  // Main Three.js Initialization
  useEffect(() => {
    if (!checkWebGL()) {
      setHasWebGlError(true);
      setIsLoading(false);
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    // 1. Scene
    const sceneHandles = buildOfficeScene(isLiteMode);
    sceneHandlesRef.current = sceneHandles;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 80);
    camera.position.set(0, 14, 16);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    // 3. Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      // Safely acquire WebGL context
      let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
      try {
        gl = (canvas.getContext("webgl2", {
          alpha: false,
          depth: true,
          stencil: true,
          antialias: !isLiteMode,
          powerPreference: "default",
        }) || canvas.getContext("webgl2")) as WebGL2RenderingContext | null;
      } catch {}

      if (!gl) {
        setHasWebGlError(true);
        setIsLoading(false);
        return;
      }

      // Safe guard on this gl instance's getShaderPrecisionFormat
      if (gl && typeof gl.getShaderPrecisionFormat === "function") {
        const orig = gl.getShaderPrecisionFormat.bind(gl);
        gl.getShaderPrecisionFormat = (shaderType: number, precisionType: number) => {
          try {
            const res = orig(shaderType, precisionType);
            if (res && typeof res.precision === "number") return res;
          } catch {}
          return { rangeMin: 0, rangeMax: 0, precision: 0 } as WebGLShaderPrecisionFormat;
        };
      }

      renderer = new THREE.WebGLRenderer({
        canvas,
        context: gl,
        antialias: !isLiteMode,
        alpha: false,
        powerPreference: "default",
        precision: "mediump",
      });
    } catch {
      setHasWebGlError(true);
      setIsLoading(false);
      return;
    }

    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLiteMode ? 1.2 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    if (!isLiteMode) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    rendererRef.current = renderer;

    // 4. Build 6 Agent 3D Characters
    const characters = new Map<string, AgentCharacter3D>();
    Object.keys(AGENT_CONFIGS).forEach((id) => {
      const char = buildAgentCharacter(id, isLiteMode);
      sceneHandles.scene.add(char.group);
      characters.set(id, char);
    });
    charactersRef.current = characters;

    setIsLoading(false);

    // 5. Raycaster for clicking agents
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getRaycastIntersects = (event: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Collect all interactive meshes
      const interactiveMeshes: THREE.Object3D[] = [...sceneHandles.zoneHitBoxes];
      characters.forEach((c) => {
        interactiveMeshes.push(...c.hitMeshes);
        interactiveMeshes.push(c.group);
      });

      return raycaster.intersectObjects(interactiveMeshes, true);
    };

    // Click handler
    let clickStartX = 0;
    let clickStartY = 0;

    const onPointerDown = (e: MouseEvent) => {
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      prevPointer.current = { x: e.clientX, y: e.clientY };

      if (e.button === 0) {
        isDragging.current = true;
      } else if (e.button === 2) {
        isPanning.current = true;
      }
    };

    const onPointerMove = (e: MouseEvent) => {
      if (!isDragging.current && !isPanning.current) {
        // Hover state
        const hits = getRaycastIntersects(e);
        canvas.style.cursor = hits.length > 0 ? "pointer" : "default";
        return;
      }

      const dx = e.clientX - prevPointer.current.x;
      const dy = e.clientY - prevPointer.current.y;
      prevPointer.current = { x: e.clientX, y: e.clientY };

      if (isDragging.current) {
        // Orbit rotate
        spherical.current.theta -= dx * 0.006;
        spherical.current.phi = Math.max(0.15, Math.min(Math.PI * 0.46, spherical.current.phi - dy * 0.006));

        targetCamPos.current.x = targetLookAt.current.x + spherical.current.radius * Math.sin(spherical.current.phi) * Math.sin(spherical.current.theta);
        targetCamPos.current.y = Math.max(2.5, targetLookAt.current.y + spherical.current.radius * Math.cos(spherical.current.phi));
        targetCamPos.current.z = targetLookAt.current.z + spherical.current.radius * Math.sin(spherical.current.phi) * Math.cos(spherical.current.theta);
      } else if (isPanning.current) {
        // Pan target & camera
        const panSpeed = 0.015;
        const right = new THREE.Vector3().crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
        targetLookAt.current.addScaledVector(right, dx * panSpeed);
        targetLookAt.current.y += dy * panSpeed;
        targetCamPos.current.addScaledVector(right, dx * panSpeed);
        targetCamPos.current.y += dy * panSpeed;
      }
    };

    const onPointerUp = (e: MouseEvent) => {
      const movedDist = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
      isDragging.current = false;
      isPanning.current = false;

      // If clicked without dragging, perform Raycast Selection
      if (movedDist < 6) {
        const hits = getRaycastIntersects(e);
        if (hits.length > 0) {
          for (const hit of hits) {
            let cur: THREE.Object3D | null = hit.object;
            while (cur) {
              if (cur.userData?.agentId) {
                onSelectAgent(cur.userData.agentId);
                return;
              }
              cur = cur.parent;
            }
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      spherical.current.radius = Math.max(5, Math.min(32, spherical.current.radius * zoomFactor));

      const dir = targetCamPos.current.clone().sub(targetLookAt.current).normalize();
      targetCamPos.current.copy(targetLookAt.current).addScaledVector(dir, spherical.current.radius);
    };

    // Touch handlers for mobile
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        clickStartX = e.touches[0].clientX;
        clickStartY = e.touches[0].clientY;
        prevPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isDragging.current = true;
      } else if (e.touches.length === 2) {
        touchStartDist.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDragging.current) {
        const dx = e.touches[0].clientX - prevPointer.current.x;
        const dy = e.touches[0].clientY - prevPointer.current.y;
        prevPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        spherical.current.theta -= dx * 0.008;
        spherical.current.phi = Math.max(0.15, Math.min(Math.PI * 0.46, spherical.current.phi - dy * 0.008));

        targetCamPos.current.x = targetLookAt.current.x + spherical.current.radius * Math.sin(spherical.current.phi) * Math.sin(spherical.current.theta);
        targetCamPos.current.y = Math.max(2.5, targetLookAt.current.y + spherical.current.radius * Math.cos(spherical.current.phi));
        targetCamPos.current.z = targetLookAt.current.z + spherical.current.radius * Math.sin(spherical.current.phi) * Math.cos(spherical.current.theta);
      } else if (e.touches.length === 2) {
        const curDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = touchStartDist.current / curDist;
        spherical.current.radius = Math.max(5, Math.min(32, spherical.current.radius * (ratio > 1 ? 1.03 : 0.97)));
        touchStartDist.current = curDist;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      isDragging.current = false;
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const dist = Math.hypot(touch.clientX - clickStartX, touch.clientY - clickStartY);
        if (dist < 8) {
          const hits = getRaycastIntersects(touch);
          if (hits.length > 0) {
            for (const hit of hits) {
              let cur: THREE.Object3D | null = hit.object;
              while (cur) {
                if (cur.userData?.agentId) {
                  onSelectAgent(cur.userData.agentId);
                  return;
                }
                cur = cur.parent;
              }
            }
          }
        }
      }
    };

    canvas.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });

    // Resize Observer for responsive viewport
    let resizeRafId: number | null = null;
    let lastWidth = width;
    let lastHeight = height;

    const resizeObserver = new ResizeObserver((entries) => {
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
      }
      resizeRafId = requestAnimationFrame(() => {
        for (const entry of entries) {
          const newWidth = Math.floor(entry.contentRect.width);
          const newHeight = Math.floor(entry.contentRect.height);
          if (
            newWidth > 0 &&
            newHeight > 0 &&
            (Math.abs(newWidth - lastWidth) > 1 || Math.abs(newHeight - lastHeight) > 1)
          ) {
            lastWidth = newWidth;
            lastHeight = newHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight, false);
          }
        }
      });
    });
    resizeObserver.observe(container);

    // 6. Animation Frame Render Loop
    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Smooth camera position and lookAt interpolation (lerp)
      camera.position.lerp(targetCamPos.current, 0.08);
      currentLookAt.current.lerp(targetLookAt.current, 0.08);
      camera.lookAt(currentLookAt.current);

      // Update office environment (server LEDs, screen animations)
      sceneHandles.update(delta, elapsed);

      // Update all 6 agent character animations
      characters.forEach((char) => {
        char.update(delta, elapsed);
      });

      renderer.render(sceneHandles.scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
      }
      resizeObserver.disconnect();

      canvas.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);

      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);

      renderer.dispose();
    };
  }, [isLiteMode, checkWebGL, onSelectAgent]);

  // Fallback 2.5D schematic view if WebGL is unavailable
  if (hasWebGlError) {
    return (
      <div
        style={{
          width: "100%",
          height: 480,
          borderRadius: 20,
          border: "1px solid var(--line)",
          background: "linear-gradient(145deg, #0f172a, #1e293b)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 12 }}>🏢</div>
        <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>GULI Agent ofisi (Sodda rejim)</h3>
        <p style={{ color: "#94a3b8", maxWidth: 520, margin: "0 0 20px", fontSize: 13, lineHeight: 1.5 }}>
          Qurilmangizda 3D WebGL tezlatgichi aniqlanmadi. Agentlar va vazifalar to‘liq faol va quyidagi interaktiv
          panellarda boshqarilishi mumkin.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {Object.values(AGENT_CONFIGS).map((cfg) => {
            const isSel = selectedAgentId === cfg.id;
            return (
              <button
                key={cfg.id}
                type="button"
                onClick={() => onSelectAgent(cfg.id)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: isSel ? `2px solid ${cfg.color}` : "1px solid rgba(255,255,255,0.15)",
                  background: isSel ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <span>{cfg.icon}</span>
                <b>{cfg.nameUz}</b>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: 520,
        borderRadius: 22,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "#090d16",
        boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          outline: "none",
        }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(15, 23, 42, 0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            color: "#fff",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              border: "3px solid rgba(255,255,255,0.1)",
              borderTopColor: "#e11d48",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <b style={{ fontSize: 14, letterSpacing: "0.05em" }}>3D VIRTUAL OFIS YUKLANMOQDA…</b>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>3D muhit, agentlar va ish stollari sozlanmoqda</span>
        </div>
      )}

      {/* Top Floating Controls Bar */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          right: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        {/* Office Status Badge */}
        <div
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            pointerEvents: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          <span style={{ color: "#10b981", fontSize: 10 }}>●</span>
          <span>GULI 3D OFISI · LIVE</span>
        </div>

        {/* Camera Preset Quick Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(12px)",
            padding: 5,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            pointerEvents: "auto",
          }}
        >
          {CAMERA_PRESETS.map((p) => {
            const isCurrent = presetKey === p.key && !selectedAgentId;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  onSelectAgent(""); // clear agent focus and switch to preset
                  onChangePreset?.(p.key);
                  const targetPreset = CAMERA_PRESETS.find((x) => x.key === p.key)!;
                  targetCamPos.current.set(...targetPreset.position);
                  targetLookAt.current.set(...targetPreset.target);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "none",
                  background: isCurrent ? "#e11d48" : "transparent",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.2s",
                }}
                title={p.labelUz}
              >
                <span>{p.icon}</span>
                <span className="camPresetLabel">{p.labelUz}</span>
              </button>
            );
          })}

          {/* Performance toggle */}
          <button
            type="button"
            onClick={() => setIsLiteMode((prev) => !prev)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.15)",
              background: isLiteMode ? "#f59e0b" : "rgba(255,255,255,0.08)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              marginLeft: 4,
            }}
            title="Grafik sifatini o‘zgartirish"
          >
            {isLiteMode ? "⚡ Yengil" : "✨ Yuqori"}
          </button>
        </div>
      </div>

      {/* Bottom Floating Agent Selector Strip */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          right: 14,
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          pointerEvents: "auto",
          zIndex: 5,
        }}
      >
        {Object.values(AGENT_CONFIGS).map((cfg) => {
          const isSelected = selectedAgentId === cfg.id;
          const char = charactersRef.current.get(cfg.id);
          const curStatus = char?.status || "idle";

          return (
            <button
              key={cfg.id}
              type="button"
              onClick={() => onSelectAgent(cfg.id)}
              style={{
                flexShrink: 0,
                padding: "8px 13px",
                borderRadius: 14,
                border: isSelected ? `2px solid ${cfg.color}` : "1px solid rgba(255,255,255,0.14)",
                background: isSelected ? "rgba(30, 41, 59, 0.95)" : "rgba(15, 23, 42, 0.8)",
                backdropFilter: "blur(10px)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                boxShadow: isSelected ? `0 6px 20px ${cfg.color}40` : "0 4px 14px rgba(0,0,0,0.2)",
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 16 }}>{cfg.icon}</span>
              <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                <b style={{ fontSize: 11, display: "block" }}>{cfg.nameUz}</b>
                <span
                  style={{
                    fontSize: 9,
                    color: curStatus === "working" ? "#38bdf8" : curStatus === "thinking" ? "#f59e0b" : "#94a3b8",
                  }}
                >
                  {curStatus === "working" ? "● Ishlamoqda" : curStatus === "thinking" ? "● O‘ylamoqda" : "● Kutmoqda"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Floating Instructions Tooltip (bottom center) */}
      <div
        style={{
          position: "absolute",
          bottom: 64,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "5px 12px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.6)",
          color: "rgba(255,255,255,0.7)",
          fontSize: 10,
          letterSpacing: "0.02em",
          pointerEvents: "none",
        }}
      >
        🖱️ Aylantirish: chap tugma · Zoom: g‘ildirak · Tanlash: agent ustiga bosing
      </div>
    </div>
  );
};
