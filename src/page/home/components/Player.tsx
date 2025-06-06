import { useEffect, useRef, useState } from "react";
import Artplayer from "artplayer";
import Hls from "hls.js";
import indicator from "../indicator.png";
import vod_loader from "../vod_loader.gif";
import { useDispatch, useSelector } from "react-redux";
import { useWatchtPostMutation } from "../services/homeApi";
import { showToast } from "../services/errorSlice";
import { setMute } from "../services/muteSlice";
import { sethideBar } from "../services/hideBarSlice";
import forward from "../Fastforward.gif";

const BUFFER_THRESHOLD = 10;
const MAX_BUFFER_SIZE = 50 * 1024 * 1024;
const POSITION_SAVE_INTERVAL = 5000;
const VIDEO_POSITIONS_KEY = "video_positions";

interface RootState {
  muteSlice: { mute: boolean };
  persist: { user: { token: string } };
  playSlice: { playstart: boolean };
}

const Player = ({
  src,
  width,
  height,
  thumbnail,
  setWidth,
  setHeight,
  handleLike,
  p_img,
  rotate,
  type,
  post_id,
  isActive,
  abortControllerRef,
  indexRef,
  videoData,
}: {
  src: string;
  thumbnail: string;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  handleLike: () => void;
  post_id: string;
  rotate: boolean;
  type: string;
  p_img: any;
  width: number;
  height: number;
  isActive: boolean;
  abortControllerRef: any;
  indexRef: any;
  videoData: any;
}) => {
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const artPlayerInstanceRef = useRef<Artplayer | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const { mute } = useSelector((state: RootState) => state.muteSlice);
  const user = useSelector((state: RootState) => state.persist.user);
  const { playstart } = useSelector((state: RootState) => state.playSlice);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlay, setIsplay] = useState(false);
  const playIconRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLInputElement | null>(null);
  const isDraggingRef = useRef(false);
  const seekTimeRef = useRef(0);
  const timeDisplayRef = useRef<HTMLDivElement | null>(null);
  const muteRef = useRef(mute);
  const watchedTimeRef = useRef(0);
  const apiCalledRef = useRef(false);
  const positionSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [watchtPost] = useWatchtPostMutation();
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fastForwardIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_DELAY = 500;
  const FAST_FORWARD_RATE = 2;
  const FAST_FORWARD_INTERVAL = 50;
  const SWIPE_THRESHOLD = 30;
  const wasPlayingRef = useRef(false);
  const isLongPressActiveRef = useRef(false);
  const [newStart, setnewStart] = useState(false);
  const watchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add cleanup tracking refs for Safari memory management
  const videoEventListenersRef = useRef<{
    element: HTMLVideoElement;
    events: { event: string; handler: EventListener }[];
  } | null>(null);
  const hlsEventListenersRef = useRef<{ event: string; handler: any }[]>([]);
  const singleClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dispatch = useDispatch();
  const currentAbortControllerRef = useRef<AbortController | null>(null);

  // Enhanced functions to coordinate loading and play button states
  const showLoadingIndicator = () => {
    const loadingIndicator =
      artPlayerInstanceRef.current?.template?.$loading?.querySelector(
        ".video-loading-indicator"
      ) as HTMLDivElement;
    if (loadingIndicator) {
      loadingIndicator.style.display = "block";
    }
    // Always hide play button when showing loading
    hidePlayButton();
  };

  const hideLoadingIndicator = () => {
    const loadingIndicator =
      artPlayerInstanceRef.current?.template?.$loading?.querySelector(
        ".video-loading-indicator"
      ) as HTMLDivElement;
    if (loadingIndicator) {
      loadingIndicator.style.display = "none";
    }
  };

  const hidePlayButton = () => {
    if (playIconRef.current) playIconRef.current.style.display = "none";
    if (artPlayerInstanceRef.current?.template?.$state) {
      const playIndicator =
        artPlayerInstanceRef.current.template.$state.querySelector(
          ".video-play-indicator"
        ) as HTMLDivElement;
      if (playIndicator) playIndicator.style.display = "none";
    }
  };

  const showPlayButton = () => {
    if (!artPlayerInstanceRef.current?.playing && !isFastForwarding) {
      // Always hide loading indicator when showing play button
      hideLoadingIndicator();
      
      if (playIconRef.current) playIconRef.current.style.display = "block";
      if (artPlayerInstanceRef.current?.template?.$state) {
        const playIndicator =
          artPlayerInstanceRef.current.template.$state.querySelector(
            ".video-play-indicator"
          ) as HTMLDivElement;
        if (playIndicator) playIndicator.style.display = "block";
      }
    }
  };

  // Enhanced cleanup function for Safari compatibility
  const cleanupVideoEventListeners = () => {
    if (videoEventListenersRef.current) {
      const { element, events } = videoEventListenersRef.current;
      events.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
      videoEventListenersRef.current = null;
    }
  };

  const cleanupHlsEventListeners = () => {
    if (hlsRef.current && hlsEventListenersRef.current.length > 0) {
      hlsEventListenersRef.current.forEach(({ event, handler }) => {
        hlsRef.current!.off(event as any, handler);
      });
      hlsEventListenersRef.current = [];
    }
  };

  const cleanupAllTimers = () => {
    if (positionSaveTimerRef.current) {
      clearInterval(positionSaveTimerRef.current);
      positionSaveTimerRef.current = null;
    }
    if (watchTimerRef.current) {
      clearInterval(watchTimerRef.current);
      watchTimerRef.current = null;
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (fastForwardIntervalRef.current) {
      clearInterval(fastForwardIntervalRef.current);
      fastForwardIntervalRef.current = null;
    }
    if (singleClickTimeoutRef.current) {
      clearTimeout(singleClickTimeoutRef.current);
      singleClickTimeoutRef.current = null;
    }
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const saveVideoPosition = (position: number) => {
    if (!user?.token || !post_id) return;
    try {
      const positionsJson = localStorage.getItem(VIDEO_POSITIONS_KEY) || "{}";
      const positions = JSON.parse(positionsJson);
      positions[post_id] = { position, timestamp: Date.now() };
      localStorage.setItem(VIDEO_POSITIONS_KEY, JSON.stringify(positions));
    } catch (error) {
      console.error("Failed to save video position:", error);
    }
  };

  const getSavedPosition = (): number | null => {
    if (!user?.token || !post_id) return null;
    try {
      const positionsJson = localStorage.getItem(VIDEO_POSITIONS_KEY) || "{}";
      const positions = JSON.parse(positionsJson);
      const savedData = positions[post_id];
      if (!savedData) return null;
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - savedData.timestamp > maxAge) {
        delete positions[post_id];
        localStorage.setItem(VIDEO_POSITIONS_KEY, JSON.stringify(positions));
        return null;
      }
      return savedData.position;
    } catch (error) {
      console.error("Failed to get saved video position:", error);
      return null;
    }
  };

  const startPositionSaving = () => {
    if (positionSaveTimerRef.current)
      clearInterval(positionSaveTimerRef.current);
    positionSaveTimerRef.current = setInterval(() => {
      if (
        artPlayerInstanceRef.current &&
        artPlayerInstanceRef.current.playing
      ) {
        const currentTime = artPlayerInstanceRef.current.currentTime;
        const duration = artPlayerInstanceRef.current.duration;
        if (currentTime > 1 && currentTime < duration - 1)
          saveVideoPosition(currentTime);
      }
    }, POSITION_SAVE_INTERVAL);
  };

  const stopPositionSaving = () => {
    if (positionSaveTimerRef.current) {
      clearInterval(positionSaveTimerRef.current);
      positionSaveTimerRef.current = null;
    }
  };

  const handleWatchHistory = () => {
    if (!apiCalledRef.current && user?.token) {
      apiCalledRef.current = true;
      if (artPlayerInstanceRef.current)
        saveVideoPosition(artPlayerInstanceRef.current.currentTime);
      watchtPost({ post_id })
        .unwrap()
        .then(() => console.log("Watch history updated"))
        .catch((error) =>
          console.error("Failed to update watch history", error)
        );
    }
  };

  const initializePlayer = () => {
    if (!playerContainerRef.current || artPlayerInstanceRef.current) return;

    Artplayer.DBCLICK_FULLSCREEN = false;
    Artplayer.MOBILE_DBCLICK_PLAY = false;
    Artplayer.MOBILE_CLICK_PLAY = true;

    const isM3u8 = src.toLowerCase().endsWith(".m3u8");

    const options: Artplayer["Option"] = {
      autoOrientation: true,
      container: playerContainerRef.current,
      url: src,
      volume: 0.5,
      muted: muteRef.current,
      autoplay: true,
      fullscreenWeb: true,
      poster: thumbnail,
      loop: true,
      moreVideoAttr: { playsInline: true, preload: "auto" },
      aspectRatio: true,
      fullscreen: false,
      theme: "#d53ff0",
      icons: {
        loading: `<div class="video-loading-indicator" style="display: none;"><img width="100" height="100" src=${vod_loader}></div>`,
        state: `<div class="video-play-indicator" style="display: none;"><img src="${indicator}" width="50" height="50" alt="Play"></div>`,
      },
      type: isM3u8 ? "m3u8" : "mp4",
      customType: {
        mp4: (video: HTMLVideoElement, url: string) => {
          video.preload = "metadata";

          // Cleanup previous abort controller
          if (currentAbortControllerRef.current) {
            currentAbortControllerRef.current.abort();
            currentAbortControllerRef.current = null;
          }

          const abortController = new AbortController();
          currentAbortControllerRef.current = abortController;
          abortControllerRef.current?.push(abortController);
          videoData?.current?.push(video);

          const loadVideo = async () => {
            try {
              const headers = new Headers();
              headers.append("Range", "bytes=0-1048576");
              const response = await fetch(url, {
                headers,
                method: "GET",
                signal: abortController?.signal,
              });
              if (response.status === 206) {
                video.src = url;
                if (isActive) video.preload = "auto";
              } else {
                video.src = url;
                video.preload = "metadata";
              }
            } catch (error) {
              // Only log errors that aren't from aborted requests
              if (
                !(error instanceof DOMException && error.name === "AbortError")
              ) {
                console.error("Error loading video:", error);
              }
              // Still set the source as fallback
              if (!abortController.signal.aborted) {
                video.src = url;
                video.preload = "metadata";
              }
            }
          };

          loadVideo().catch((error) => {
            // Only log errors that aren't from aborted requests
            if (
              !(error instanceof DOMException && error.name === "AbortError")
            ) {
              console.error("Error in loadVideo:", error);
            }
          });

          // Enhanced event listener tracking for Safari
          const canplaythroughHandler = () => {
            if (isActive) video.preload = "auto";
          };
          const waitingHandler = () => {
            if (isActive) video.preload = "auto";
          };

          video.addEventListener("canplaythrough", canplaythroughHandler);
          video.addEventListener("waiting", waitingHandler);

          // Track event listeners for proper cleanup
          videoEventListenersRef.current = {
            element: video,
            events: [
              { event: "canplaythrough", handler: canplaythroughHandler },
              { event: "waiting", handler: waitingHandler },
            ],
          };

          return () => {
            if (video) {
              video.pause();
              video.removeAttribute("src");
              video.load();
            }

            // Clean up tracked event listeners
            cleanupVideoEventListeners();

            // Abort any in-progress fetches when custom type is disposed
            if (abortController && !abortController.signal.aborted) {
              abortController.abort();
            }
          };
        },
        m3u8: (videoElement: HTMLVideoElement, url: string) => {
          if (Hls.isSupported()) {
            // Clean up any existing HLS instance and its event listeners
            cleanupHlsEventListeners();
            if (hlsRef.current) {
              hlsRef.current.detachMedia();
              hlsRef.current.destroy();
              hlsRef.current = null;
            }

            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 10,
              maxBufferLength: 20,
              maxMaxBufferLength: 30,
              maxBufferSize: 10 * 1000 * 1000,
              maxBufferHole: 0.5,
              maxFragLookUpTolerance: 0.25,
              startLevel: -1,
              abrEwmaDefaultEstimate: 500000,
              abrBandWidthFactor: 0.95,
              abrBandWidthUpFactor: 0.7,
              abrMaxWithRealBitrate: true,
              startFragPrefetch: false,
              fpsDroppedMonitoringThreshold: 0.2,
              fpsDroppedMonitoringPeriod: 1000,
              capLevelToPlayerSize: true,
              initialLiveManifestSize: 1,
              stretchShortVideoTrack: true,
              forceKeyFrameOnDiscontinuity: true,
              manifestLoadingTimeOut: 10000,
              manifestLoadingMaxRetry: 2,
              manifestLoadingRetryDelay: 500,
              manifestLoadingMaxRetryTimeout: 5000,
              levelLoadingTimeOut: 10000,
              levelLoadingMaxRetry: 2,
              levelLoadingRetryDelay: 500,
              levelLoadingMaxRetryTimeout: 5000,
              fragLoadingTimeOut: 20000,
              fragLoadingMaxRetry: 3,
              fragLoadingRetryDelay: 500,
              fragLoadingMaxRetryTimeout: 5000,
            });

            // Enhanced HLS event listener tracking
            const errorHandler = (event: any, data: any) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    hls.destroy();
                    break;
                }
              }
            };

            const manifestParsedHandler = () => {
              if (isActive && playstart) {
                videoElement
                  .play()
                  .catch((error) =>
                    console.warn("Auto-play prevented:", error)
                  );
              }
            };

            hls.on(Hls.Events.ERROR, errorHandler);
            hls.on(Hls.Events.MANIFEST_PARSED, manifestParsedHandler);

            // Track HLS event listeners for cleanup
            hlsEventListenersRef.current = [
              { event: Hls.Events.ERROR, handler: errorHandler },
              { event: Hls.Events.MANIFEST_PARSED, handler: manifestParsedHandler },
            ];

            hls.loadSource(url);
            hls.attachMedia(videoElement);
            hlsRef.current = hls;
          } else {
            videoElement.src = url;
            videoElement.preload = "auto";
            
            const canplayHandler = () => {
              if (isActive && playstart)
                videoElement
                  .play()
                  .catch((error) =>
                    console.warn("Auto-play prevented:", error)
                  );
            };
            
            videoElement.addEventListener("canplay", canplayHandler);
            
            // Track event listener for cleanup
            videoEventListenersRef.current = {
              element: videoElement,
              events: [{ event: "canplay", handler: canplayHandler }],
            };
          }
        },
      },
      layers: [
        {
          html: `
            <div class="custom-progress-container">
              <input type="range" min="0" max="100" step="0.1" class="custom-progress-bar chrome-fix" />
              <div class="custom-time-display"></div>
            </div>`,
          style: {
            position: "absolute",
            bottom: "0px",
            left: "5%",
            width: "90%",
            height: "25px",
            zIndex: "9999",
            pointerEvents: "auto",
            display: "block",
            visibility: "visible",
          },
          mounted: (element: HTMLElement) => {
            progressBarRef.current = element.querySelector(
              ".custom-progress-bar"
            ) as HTMLInputElement;
            timeDisplayRef.current = element.querySelector(
              ".custom-time-display"
            ) as HTMLDivElement;

            if (!progressBarRef.current) return;

            progressBarRef.current.value = "0";
            progressBarRef.current.style.opacity = "1";
            progressBarRef.current.style.display = "block";
            progressBarRef.current.style.visibility = "visible";

            const isChrome =
              /Chrome/.test(navigator.userAgent) &&
              /Google Inc/.test(navigator.vendor);
            if (isChrome) {
              progressBarRef.current.style.webkitAppearance = "none";
              progressBarRef.current.style.appearance = "none";
              progressBarRef.current.style.background =
                "rgba(255, 255, 255, 0.2)";
              progressBarRef.current.style.height = "4px";
              progressBarRef.current.style.borderRadius = "2px";
              progressBarRef.current.style.outline = "none";
              progressBarRef.current.style.transition = "opacity 0.2s";
              progressBarRef.current.style.cursor = "pointer";
            }

            progressBarRef.current.addEventListener("input", (e) => {
              if (!artPlayerInstanceRef.current) return;
              if (!isDraggingRef.current) {
                dispatch(sethideBar(true));
                if (progressBarRef.current) {
                  progressBarRef.current.style.height = "10px";
                  progressBarRef.current.style.setProperty(
                    "--thumb-width",
                    "16px"
                  );
                  progressBarRef.current.style.setProperty(
                    "--thumb-height",
                    "20px"
                  );
                  progressBarRef.current.style.setProperty(
                    "--thumb-radius",
                    "5px"
                  );
                }
                isDraggingRef.current = true;
                if (timeDisplayRef.current) timeDisplayRef.current.style.display = "block";
              }
              const value = parseFloat((e.target as HTMLInputElement).value);
              seekTimeRef.current =
                (value / 100) * artPlayerInstanceRef.current.duration;
              progressBarRef.current?.style.setProperty(
                "--progress",
                `${value}%`
              );
              if (timeDisplayRef.current) {
                const currentTime = formatTime(seekTimeRef.current);
                const duration = formatTime(
                  artPlayerInstanceRef.current.duration
                );
                timeDisplayRef.current.textContent = `${currentTime} / ${duration}`;
              }
            });

            progressBarRef.current.addEventListener("change", () => {
              if (!artPlayerInstanceRef.current || !isDraggingRef.current)
                return;
              isDraggingRef.current = false;
              dispatch(sethideBar(false));
              if (progressBarRef.current) {
                progressBarRef.current.style.height = "4px";
                progressBarRef.current.style.setProperty("--thumb-width", "6px");
                progressBarRef.current.style.setProperty(
                  "--thumb-height",
                  "16px"
                );
                progressBarRef.current.style.setProperty("--thumb-radius", "5px");
              }
              if (timeDisplayRef.current) timeDisplayRef.current.style.display = "none";
              artPlayerInstanceRef.current.currentTime = seekTimeRef.current;
            });

            element.addEventListener("touchstart", (e) => {
              if (!artPlayerInstanceRef.current || !progressBarRef.current)
                return;
              const touch = e.touches[0];
              const rect = element.getBoundingClientRect();
              const touchX = touch.clientX - rect.left;
              const percent = Math.min(
                Math.max((touchX / rect.width) * 100, 0),
                100
              );
              progressBarRef.current.value = percent.toString();
              progressBarRef.current.style.setProperty(
                "--progress",
                `${percent}%`
              );
              isDraggingRef.current = true;
              dispatch(sethideBar(true));
              progressBarRef.current.style.height = "10px";
              progressBarRef.current.style.setProperty("--thumb-width", "16px");
              progressBarRef.current.style.setProperty(
                "--thumb-height",
                "20px"
              );
              progressBarRef.current.style.setProperty("--thumb-radius", "5px");
              if (timeDisplayRef.current) timeDisplayRef.current.style.display = "block";
              const newTime =
                (percent / 100) * artPlayerInstanceRef.current.duration;
              seekTimeRef.current = newTime;
              if (timeDisplayRef.current) {
                const currentTime = formatTime(newTime);
                const duration = formatTime(
                  artPlayerInstanceRef.current.duration
                );
                timeDisplayRef.current.textContent = `${currentTime} / ${duration}`;
              }
            });

            element.addEventListener("touchmove", (e) => {
              if (
                !artPlayerInstanceRef.current ||
                !progressBarRef.current ||
                !isDraggingRef.current
              )
                return;
              e.preventDefault();
              const touch = e.touches[0];
              const rect = element.getBoundingClientRect();
              const touchX = touch.clientX - rect.left;
              const percent = Math.min(
                Math.max((touchX / rect.width) * 100, 0),
                100
              );
              progressBarRef.current.value = percent.toString();
              progressBarRef.current.style.setProperty(
                "--progress",
                `${percent}%`
              );
              seekTimeRef.current =
                (percent / 100) * artPlayerInstanceRef.current.duration;
              if (timeDisplayRef.current) {
                const currentTime = formatTime(seekTimeRef.current);
                const duration = formatTime(
                  artPlayerInstanceRef.current.duration
                );
                timeDisplayRef.current.textContent = `${currentTime} / ${duration}`;
              }
            });

            element.addEventListener("touchend", () => {
              if (
                !artPlayerInstanceRef.current ||
                !progressBarRef.current ||
                !isDraggingRef.current
              )
                return;
              isDraggingRef.current = false;
              dispatch(sethideBar(false));
              progressBarRef.current.style.height = "4px";
              progressBarRef.current.style.setProperty("--thumb-width", "6px");
              progressBarRef.current.style.setProperty(
                "--thumb-height",
                "16px"
              );
              progressBarRef.current.style.setProperty("--thumb-radius", "5px");
              if (timeDisplayRef.current) timeDisplayRef.current.style.display = "none";
              artPlayerInstanceRef.current.currentTime = seekTimeRef.current;
            });
          },
        },
        {
          html: `<div class="custom-play-icon">
                    <img src="${indicator}" width="50" height="50" alt="Play">
                 </div>`,
          style: {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: "999",
            display: "none",
          },
          mounted: (element: HTMLElement) => {
            playIconRef.current = element as HTMLDivElement;

            playIconRef?.current?.addEventListener("click", () => {
              if (artPlayerInstanceRef.current) {
                // Show loading indicator and hide play button immediately
                showLoadingIndicator();

                // Don't fade out poster immediately - wait until play succeeds
                artPlayerInstanceRef.current
                  .play()
                  .then(() => {
                    // Play succeeded - hide loading indicator and keep play button hidden
                    hideLoadingIndicator();
                    hidePlayButton();

                    // Only fade out poster when we have actual frames
                    if (
                      artPlayerInstanceRef.current?.video &&
                      artPlayerInstanceRef.current.video.readyState >= 3
                    ) {
                      setTimeout(() => safeFadePosterOut(true), 100);
                    } else if (artPlayerInstanceRef.current?.video) {
                      // If video isn't ready yet, wait for it
                      const checkReadyState = () => {
                        if (
                          artPlayerInstanceRef.current?.video &&
                          artPlayerInstanceRef.current.video.readyState >= 3
                        ) {
                          safeFadePosterOut(true);
                          artPlayerInstanceRef.current.video.removeEventListener(
                            "canplay",
                            checkReadyState
                          );
                        }
                      };
                      if (artPlayerInstanceRef.current) {
                        artPlayerInstanceRef.current.video.addEventListener(
                          "canplay",
                          checkReadyState
                        );
                      }
                    }
                  })
                  .catch((error) => {
                    console.error("Manual play failed:", error);

                    // Play failed - hide loading indicator and show play button again
                    hideLoadingIndicator();
                    showPlayButton();

                    // Keep poster visible on error
                    showPoster();
                  });
              }
            });
          },
        },
        {
          html: `
            <div class="click-layer">
              <div class="fast-forward-indicator" style="display: none; opacity: 0;">
                <span>快进播放 x2</span>
                <img src="${forward}" alt="forward" style="width: 16px; height: 16px;" />
              </div>
            </div>`,
          style: {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "95%",
            zIndex: "10",
            background: "transparent",
            userSelect: "none",
            WebkitUserSelect: "none",
            touchAction: "pan-y",
          } as any,
          mounted: (element: HTMLElement) => {
            let lastClick = 0;
            let isLongPress = false;
            const ffIndicator = element.querySelector(
              ".fast-forward-indicator"
            ) as HTMLElement;

            if (ffIndicator) {
              Object.assign(ffIndicator.style, {
                position: "absolute",
                bottom: "0%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                backgroundColor: "#282630",
                color: "white",
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: "500",
                display: "none",
                opacity: "0",
                alignItems: "center",
                gap: "8px",
                minWidth: "120px",
                justifyContent: "center",
                letterSpacing: "0.5px",
                transition: "opacity 0.3s ease-in-out",
                zIndex: "9999",
              });
            }

            const handleLongPressStart = (e: TouchEvent | MouseEvent) => {
              if ("touches" in e) {
                const touch = e.touches[0];
                touchStartPosRef.current = {
                  x: touch.clientX,
                  y: touch.clientY,
                };
              }
              if (longPressTimerRef.current)
                clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = setTimeout(() => {
                if (touchStartPosRef.current) {
                  isLongPress = true;
                  isLongPressActiveRef.current = true;
                  startFastForward();
                  if (ffIndicator) {
                    ffIndicator.style.display = "flex";
                    ffIndicator.style.transition = "opacity 0.2s ease-in-out";
                    ffIndicator.style.opacity = "1";
                  }
                }
              }, LONG_PRESS_DELAY);
            };

            const handleLongPressEnd = () => {
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
              if (isLongPress) {
                stopFastForward();
                if (ffIndicator) {
                  ffIndicator.style.opacity = "0";
                  setTimeout(() => {
                    ffIndicator.style.display = "none";
                  }, 200);
                }
              }
              isLongPress = false;
              isLongPressActiveRef.current = false;
              touchStartPosRef.current = null;
            };

            const handleTouchMove = (e: TouchEvent) => {
              if (!touchStartPosRef.current) return;
              const touch = e.touches[0];
              const deltaX = Math.abs(
                touch.clientX - touchStartPosRef.current.x
              );
              const deltaY = Math.abs(
                touch.clientY - touchStartPosRef.current.y
              );
              if (
                (deltaX > SWIPE_THRESHOLD || deltaY > SWIPE_THRESHOLD) &&
                !isLongPressActiveRef.current
              ) {
                handleLongPressEnd();
                return;
              }
              if (
                isLongPressActiveRef.current &&
                (deltaX > SWIPE_THRESHOLD * 3 || deltaY > SWIPE_THRESHOLD * 3)
              ) {
                handleLongPressEnd();
                return;
              }
              e.preventDefault();
            };

            element.addEventListener("touchstart", (e) => {
              const now = Date.now();
              if (now - lastClick <= 300) {
                if (singleClickTimeoutRef.current) clearTimeout(singleClickTimeoutRef.current);
                if (user?.token) handleLike();
                else
                  dispatch(
                    showToast({ message: "登陆后可点赞", type: "success" })
                  );
              } else {
                singleClickTimeoutRef.current = setTimeout(() => {
                  if (!isLongPress && artPlayerInstanceRef.current) {
                    if (artPlayerInstanceRef.current.playing) {
                      artPlayerInstanceRef.current.pause();
                      showPlayButton();
                    } else {
                      artPlayerInstanceRef.current.play();
                      safeFadePosterOut(true);

                      hidePlayButton();
                    }
                  }
                }, 300);
              }
              lastClick = now;
              handleLongPressStart(e);
            });

            element.addEventListener("touchmove", handleTouchMove);
            element.addEventListener("touchend", handleLongPressEnd);
            element.addEventListener("touchcancel", handleLongPressEnd);
            element.addEventListener("contextmenu", (e) => e.preventDefault());
          },
        },
      ],
    };

    artPlayerInstanceRef.current = new Artplayer(options);
    if (artPlayerInstanceRef.current?.template?.$poster) {
      const posterElement = artPlayerInstanceRef.current.template.$poster;

      // Apply strong CSS transitions with longer duration
      posterElement.style.cssText += `
        transition: opacity 1s ease-out !important;
        -webkit-transition: opacity 1s ease-out !important;
        opacity: 1 !important;
        visibility: visible !important;
        display: block !important;
      `;

      // Add a custom class for easier targeting
      posterElement.classList.add("art-poster-with-transition");

      // Add transitionend listener to properly handle the end of transition
      posterElement.addEventListener("transitionend", (e) => {
        if (
          e.propertyName === "opacity" &&
          getComputedStyle(posterElement).opacity === "0"
        ) {
          posterElement.style.display = "none";
        }
      });

      // Force a reflow to ensure styles are applied
      void posterElement.offsetWidth;
    }

    artPlayerInstanceRef.current.on("ready", () => {
      const savedPosition = getSavedPosition();
      if (savedPosition)
        artPlayerInstanceRef.current!.currentTime = savedPosition;
      startPositionSaving();
    });

    artPlayerInstanceRef.current.on("video:timeupdate", () => {
      if (
        progressBarRef.current &&
        artPlayerInstanceRef.current &&
        !isDraggingRef.current
      ) {
        const currentTime = artPlayerInstanceRef.current.currentTime || 0;
        const duration = artPlayerInstanceRef.current.duration || 1;
        const newProgress = (currentTime / duration) * 100;
        progressBarRef.current.value = newProgress.toString();
        progressBarRef.current.style.setProperty(
          "--progress",
          `${newProgress}%`
        );
        if (progressBarRef.current.style.opacity !== "1")
          progressBarRef.current.style.opacity = "1";

        if (currentTime > 0.5 && artPlayerInstanceRef.current.playing) {
          safeFadePosterOut();
        }
      }
    });

    artPlayerInstanceRef.current.on("video:waiting", () => {
      if (progressBarRef?.current) progressBarRef.current.style.opacity = "1";

      if (
        artPlayerInstanceRef.current &&
        artPlayerInstanceRef.current.currentTime < 0.5
      ) {
        showPoster();
      }
      
      // Show loading indicator and hide play button
      showLoadingIndicator();
    });

    artPlayerInstanceRef.current.on("error", (error) => {
      console.error("Video loading error:", error);
      if (progressBarRef?.current) progressBarRef.current.style.opacity = "1";
      showPoster();
      // Hide loading indicator and show play button on error
      hideLoadingIndicator();
      showPlayButton();
    });

    artPlayerInstanceRef.current.on("play", () => {
      if (
        artPlayerInstanceRef.current &&
        artPlayerInstanceRef.current.currentTime < 0.5
      ) {
        showPoster();
      }

      if (artPlayerInstanceRef.current) if (!isFastForwarding) hidePlayButton();
    });

    artPlayerInstanceRef.current.on("pause", () => {
      if (!isFastForwarding) showPlayButton();
    });
    artPlayerInstanceRef.current.on("video:playing", () => {
      // Hide play button first
      if (!isFastForwarding) {
        hidePlayButton();
      }

      // Only fade out the poster if we have enough data to show frames
      if (
        artPlayerInstanceRef.current?.video &&
        artPlayerInstanceRef.current.video.readyState >= 3
      ) {
        // Wait a short time to ensure frames are visible before fading out poster
        setTimeout(() => safeFadePosterOut(true), 100);
      } else if (artPlayerInstanceRef.current?.video) {
        // If not enough data yet, set up a readyState check
        const checkReadyState = () => {
          if (
            artPlayerInstanceRef.current?.video &&
            artPlayerInstanceRef.current.video.readyState >= 3
          ) {
            safeFadePosterOut(true);
            artPlayerInstanceRef.current.video.removeEventListener(
              "canplay",
              checkReadyState
            );
          }
        };
        artPlayerInstanceRef.current.video.addEventListener(
          "canplay",
          checkReadyState
        );
      }
    });

    artPlayerInstanceRef.current.on("video:pause", () => {
      if (!isFastForwarding) showPlayButton();
    });
    
    artPlayerInstanceRef.current.on("video:canplay", () => {
      // Hide loading indicator when video can play
      hideLoadingIndicator();
      
      if (
        artPlayerInstanceRef.current &&
        !artPlayerInstanceRef.current.playing &&
        !isFastForwarding
      )
        showPlayButton();
      else hidePlayButton();
    });

    artPlayerInstanceRef.current.on("video:ended", () => {
      if (user?.token && post_id) {
        try {
          const positionsJson =
            localStorage.getItem(VIDEO_POSITIONS_KEY) || "{}";
          const positions = JSON.parse(positionsJson);
          if (positions[post_id]) {
            delete positions[post_id];
            localStorage.setItem(
              VIDEO_POSITIONS_KEY,
              JSON.stringify(positions)
            );
          }
        } catch (error) {
          console.error("Failed to clear video position:", error);
        }
      }
      stopPositionSaving();

      if (watchTimerRef.current) {
        clearInterval(watchTimerRef.current);
        watchTimerRef.current = null;
      }
      watchedTimeRef.current = 0;
      watchTimerRef.current = setInterval(() => {
        watchedTimeRef.current += 1;
        if (watchedTimeRef.current >= 5 && !apiCalledRef.current && !type)
          handleWatchHistory();
      }, 1000);
    });
  };

  const updateVideoSource = (newSrc: string, newThumbnail: string) => {
    if (!artPlayerInstanceRef.current) return;

    if (artPlayerInstanceRef.current && newThumbnail) {
      artPlayerInstanceRef.current.poster = newThumbnail;

      // Always ensure poster is visible during initial loading - use single animation frame
      requestAnimationFrame(() => {
        if (artPlayerInstanceRef.current) {
          const posterElement = artPlayerInstanceRef.current.template.$poster;

          // Apply all styles in a single operation to prevent flickering
          posterElement.style.cssText += `
            display: block !important;
            visibility: visible !important;
            transition: opacity 1s ease-out !important;
            -webkit-transition: opacity 1s ease-out !important;
            opacity: 1 !important;
          `;

          posterElement.classList.add("art-poster-with-transition");
        }
      });
    }

    // Abort any in-progress fetches for the previous video
    if (currentAbortControllerRef.current) {
      currentAbortControllerRef.current.abort();
      currentAbortControllerRef.current = null;
    }

    const videoElement = artPlayerInstanceRef.current.video;
    const isM3u8 = newSrc.toLowerCase().endsWith(".m3u8");

    // Setup watch timer function
    const setupWatchTimer = () => {
      // Clear any existing timer first
      cleanupWatchTimer();

      // Set up a new timer
      watchTimerRef.current = setInterval(() => {
        watchedTimeRef.current += 1;

        // Trigger API call after 5 seconds of playback
        if (watchedTimeRef.current >= 5 && !apiCalledRef.current && !type) {
          handleWatchHistory();
          cleanupWatchTimer();
        }
      }, 1000);
    };

    // Cleanup watch timer function
    const cleanupWatchTimer = () => {
      if (watchTimerRef.current) {
        clearInterval(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    };

    // Update event handlers
    artPlayerInstanceRef.current.off("play");
    artPlayerInstanceRef.current.off("pause");
    artPlayerInstanceRef.current.on("play", () => {
      setupWatchTimer();
    });
    artPlayerInstanceRef.current.on("pause", () => {
      cleanupWatchTimer();
    });

    // Reset video element state
    videoElement.pause();
    videoElement.removeAttribute("src");
    videoElement.load();

    // Clean up existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.detachMedia();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Update Artplayer state
    artPlayerInstanceRef.current.url = newSrc;

    artPlayerInstanceRef.current.type = isM3u8 ? "m3u8" : "mp4";

    // Reset progress bar
    if (progressBarRef.current) {
      progressBarRef.current.value = "0";
      progressBarRef.current.style.setProperty("--progress", "0%");
    }

    // Show loading indicator and hide play button when updating source
    const loadingIndicator =
      artPlayerInstanceRef.current.template?.$loading?.querySelector(
        ".video-loading-indicator"
      ) as HTMLDivElement;
    if (loadingIndicator) {
      loadingIndicator.style.display = "block";
      // Hide play button when showing loading for new source
      hidePlayButton();
    }

    if (isM3u8 && Hls.isSupported()) {
      // HLS video handling
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 10,
        maxBufferLength: 20,
        maxMaxBufferLength: 30,
        maxBufferSize: 10 * 1000 * 1000,
        maxBufferHole: 0.5,
        maxFragLookUpTolerance: 0.25,
        startLevel: -1,
        abrEwmaDefaultEstimate: 500000,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7,
        abrMaxWithRealBitrate: true,
        startFragPrefetch: false,
        fpsDroppedMonitoringThreshold: 0.2,
        fpsDroppedMonitoringPeriod: 1000,
        capLevelToPlayerSize: true,
        initialLiveManifestSize: 1,
        stretchShortVideoTrack: true,
        forceKeyFrameOnDiscontinuity: true,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 500,
        manifestLoadingMaxRetryTimeout: 5000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 2,
        levelLoadingRetryDelay: 500,
        levelLoadingMaxRetryTimeout: 5000,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 5000,
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        hls.startLoad();
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (playstart && videoElement.paused) {
          videoElement.play().catch(showPlayButton);
        }
      });

      hls.loadSource(newSrc);
      hls.attachMedia(videoElement);
      hlsRef.current = hls;
      console.log('hls ....')
    } else {
      // MP4 video handling
      cleanupWatchTimer();
      watchedTimeRef.current = 0;
      apiCalledRef.current = false;

      // Create new abort controller for the MP4 fetch
      const abortController = new AbortController();
      currentAbortControllerRef.current = abortController;

      // Load MP4 with range request for metadata first
      const loadMP4 = async () => {
        try {
          const headers = new Headers();
          headers.append("Range", "bytes=0-1048576"); // First 1MB for metadata

          const response = await fetch(newSrc, {
            headers,
            method: "GET",
            signal: abortController.signal,
          });

          if (response.status === 206 || response.status === 200) {
            videoElement.src = newSrc;
            if (isActive) videoElement.preload = "auto";
          }
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("Error loading MP4:", error);
          }
          // Fallback to direct src assignment if fetch fails
          if (!abortController.signal.aborted) {
            videoElement.src = newSrc;
          }
        }
      };

      loadMP4().catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("MP4 load error:", error);
        }
      });

      // Start watch timer if playing
      if (playstart) {
        videoElement
          .play()
          .then(() => {
            setupWatchTimer();
            hidePlayButton();
          })
          .catch((error) => {
            console.warn("Auto-play prevented:", error);
            showPlayButton();
          });
      }

      // Attempt to play if active
      if (isActive) {
        const savedPosition = getSavedPosition();
        if (savedPosition) {
          videoElement.currentTime = savedPosition;
        }
      }
    }
  };

  const safeFadePosterOut = (force = false) => {
    if (!artPlayerInstanceRef.current?.template?.$poster) return;

    const posterElement = artPlayerInstanceRef.current.template.$poster;
    const videoElement = artPlayerInstanceRef.current.video;

    if (!videoElement) return;

    // Use requestAnimationFrame to ensure style changes are batched properly
    requestAnimationFrame(() => {
      // Ensure transition is applied before changing opacity
      if (!posterElement.classList.contains("art-poster-with-transition")) {
        posterElement.style.cssText += `
          transition: opacity 1s ease-out !important;
          -webkit-transition: opacity 1s ease-out !important;
          visibility: visible !important;
          display: block !important;
        `;
        posterElement.classList.add("art-poster-with-transition");
        // Force a reflow to ensure transition is applied
        void posterElement.offsetWidth;
      }

      // Only fade out if:
      // 1. We're forcing it (from a known good state) OR
      // 2. The video is actually ready to play AND either playing or has buffered content
      if (
        force ||
        (videoElement.readyState >= 3 &&
          (artPlayerInstanceRef.current?.playing ||
            videoElement.buffered.length > 0))
      ) {
        posterElement.style.cssText += `opacity: 0 !important;`;
      }
    });
  };

  const showPoster = () => {
    if (!artPlayerInstanceRef.current?.template?.$poster) return;

    const posterElement = artPlayerInstanceRef.current.template.$poster;

    // Use requestAnimationFrame to ensure styles are applied together
    requestAnimationFrame(() => {
      // Apply all styles in a single operation
      posterElement.style.cssText += `
        display: block !important;
        visibility: visible !important;
        transition: opacity 1s ease-out !important;
        -webkit-transition: opacity 1s ease-out !important;
      `;

      if (!posterElement.classList.contains("art-poster-with-transition")) {
        posterElement.classList.add("art-poster-with-transition");
      }

      // Force a reflow to ensure style changes are processed
      void posterElement.offsetWidth;

      // Now set opacity in a separate frame to ensure transition happens
      requestAnimationFrame(() => {
        posterElement.style.cssText += `opacity: 1 !important;`;
      });
    });
  };

  let watchTimer: NodeJS.Timeout | null = null;

  const attemptPlay = () => {
    if (!artPlayerInstanceRef.current) return;

    if (playstart) {
      // Ensure poster is visible and loading indicator is shown during play attempt
      showPoster();
      // Show loading indicator and hide play button
      showLoadingIndicator();

      // For HLS videos, make sure video is loaded before attempting play
      if (hlsRef.current) {
        // Ensure HLS has loaded enough data
        const videoElement = artPlayerInstanceRef.current.video;
        const buffered = videoElement.buffered;

        if (buffered && buffered.length > 0) {
          const bufferedEnd = buffered.end(buffered.length - 1);
          const currentTime = videoElement.currentTime || 0;

          // If we have enough buffered data, play
          if (bufferedEnd - currentTime > 1) {
            artPlayerInstanceRef.current
              .play()
              .then(() => {
                // Play succeeded - hide loading indicator and keep play button hidden
                hideLoadingIndicator();
                hidePlayButton();

                // Only fade out poster when we have actual frames
                setTimeout(() => {
                  if (
                    artPlayerInstanceRef.current?.video &&
                    artPlayerInstanceRef.current.video.readyState >= 3
                  ) {
                    safeFadePosterOut(true);
                  }
                }, 100);
              })
              .catch((error) => {
                console.error("Video play failed:", error);

                // Play failed - hide loading indicator and show play button
                hideLoadingIndicator();
                showPlayButton();

                // Keep poster visible on error
                showPoster();
              });
          } else {
            // Not enough buffered data yet, wait a bit and try again
            setTimeout(attemptPlay, 500);
          }
        } else {
          // No buffered data yet, wait a bit and try again
          setTimeout(attemptPlay, 500);
        }
      } else {
        // For non-HLS videos, just try to play
        artPlayerInstanceRef.current
          .play()
          .then(() => {
            // Play succeeded - hide loading indicator and keep play button hidden
            hideLoadingIndicator();
            hidePlayButton();

            // Only fade out poster when we have actual frames
            setTimeout(() => {
              if (
                artPlayerInstanceRef.current?.video &&
                artPlayerInstanceRef.current.video.readyState >= 3
              ) {
                safeFadePosterOut(true);
              }
            }, 100);
          })
          .catch((error) => {
            console.error("Video play failed:", error);

            // Play failed - hide loading indicator and show play button
            hideLoadingIndicator();
            showPlayButton();

            // Keep poster visible on error
            showPoster();

            // Handle autoplay blocking specifically
            if (error.name === "NotAllowedError") {
              if (artPlayerInstanceRef.current) {
                artPlayerInstanceRef.current.pause();
                // Show controls to allow manual play
                artPlayerInstanceRef.current.controls.show = true;
              }
            }
          });
      }
    }
  };

  useEffect(() => {
    initializePlayer();
    return () => {
      // Enhanced cleanup for Safari memory management
      cleanupAllTimers();
      cleanupVideoEventListeners();
      cleanupHlsEventListeners();

      // Reset API called flag to ensure proper tracking for next mount
      apiCalledRef.current = false;
      watchedTimeRef.current = 0;

      // Save position before unmounting
      if (artPlayerInstanceRef.current) {
        saveVideoPosition(artPlayerInstanceRef.current.currentTime);
        // Clean up the current abort controller
        if (currentAbortControllerRef.current) {
          currentAbortControllerRef.current.abort();
          currentAbortControllerRef.current = null;
        }

        stopPositionSaving();
        if (artPlayerInstanceRef.current) {
          const video = artPlayerInstanceRef.current.video;
          if (video) {
            video.pause();
            video.removeAttribute("src");
            video.load();
          }
          artPlayerInstanceRef.current.destroy();
          artPlayerInstanceRef.current = null;
        }
        if (hlsRef.current) {
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      }
    };
  }, []);

  // Ensure cleanup when component is not active
  useEffect(() => {
    if (!isActive && artPlayerInstanceRef.current) {
      artPlayerInstanceRef.current.pause();

      // Only preserve resources for videos currently in view
      if (currentAbortControllerRef.current && Math.abs(indexRef.current) > 1) {
        currentAbortControllerRef.current.abort();
        currentAbortControllerRef.current = null;
      }
    } else if (isActive && artPlayerInstanceRef.current) {
      attemptPlay();
    }
  }, [isActive]);

  useEffect(() => {
    if (artPlayerInstanceRef.current && src) {
      updateVideoSource(src, thumbnail);
    }
  }, [src, thumbnail]);

  useEffect(() => {
    if (playstart && !newStart) {
      attemptPlay();
      setnewStart(true);
    }
  }, [playstart]);

  useEffect(() => {
    muteRef.current = mute;
    if (artPlayerInstanceRef.current) artPlayerInstanceRef.current.muted = mute;
  }, [mute]);

  useEffect(() => {
    if (artPlayerInstanceRef.current)
      artPlayerInstanceRef.current.fullscreen = rotate;
  }, [rotate]);

  const startFastForward = () => {
    if (!artPlayerInstanceRef.current) return;
    wasPlayingRef.current = artPlayerInstanceRef.current.playing;
    setIsFastForwarding(true);
    isLongPressActiveRef.current = true;
    hidePlayButton();
    dispatch(sethideBar(true));
    const player = artPlayerInstanceRef.current;
    player.play();
    player.playbackRate = FAST_FORWARD_RATE;
    if (progressBarRef.current) {
      progressBarRef.current.style.opacity = "1";
      progressBarRef.current.style.display = "block";
    }
    fastForwardIntervalRef.current = setInterval(() => {
      if (player.currentTime >= player.duration - 1) stopFastForward();
      if (progressBarRef.current) {
        const currentTime = player.currentTime || 0;
        const duration = player.duration || 1;
        const newProgress = (currentTime / duration) * 100;
        progressBarRef.current.value = newProgress.toString();
        progressBarRef.current.style.setProperty(
          "--progress",
          `${newProgress}%`
        );
      }
    }, FAST_FORWARD_INTERVAL);
  };

  const stopFastForward = () => {
    if (!artPlayerInstanceRef.current) return;
    if (fastForwardIntervalRef.current) {
      clearInterval(fastForwardIntervalRef.current);
      fastForwardIntervalRef.current = null;
    }
    const player = artPlayerInstanceRef.current;
    player.playbackRate = 1;
    setIsFastForwarding(false);
    isLongPressActiveRef.current = false;
    dispatch(sethideBar(false));
    player.play();
    hidePlayButton();
  };

  return (
    <div
      ref={playerContainerRef}
      className={`video_player w-full ${p_img ? "poster_change" : ""}`}
      style={{ minHeight: "200px" }}
    />
  );
};

export default Player;
