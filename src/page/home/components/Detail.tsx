import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useGetConfigQuery,
  useGetMydayQuery,
  useGetUserMydayQuery,
  useWatchtPostMutation,
} from "../services/homeApi";
import HeartCount from "./Heart";
import Ads from "./Ads";
import VideoFooter from "./VideoFooter";
import { decryptImage } from "@/utils/imageDecrypt";
import DetailContainer from "./detail/DetailContainer";
import loader from "../vod_loader.gif";
import LoadingBar from "./detail/LoadingBar";

const Detail = () => {
  const { id } = useParams();
  // const { data: myday } = useGetMydayQuery({ page: 1 });
  const [watchPost] = useWatchtPostMutation();

  // Filter and prepare user data
  // const followers = myday?.data.filter((follower: any) => !follower?.uploaded);
  const [currentUserId, setCurrentUserId] = useState(id);
  // const [isTransitioning, setIsTransitioning] = useState(false);

  // Get videos for current user
  const { data, refetch } = useGetUserMydayQuery({
    post_user_id: currentUserId,
  });

  // Find current user index and get adjacent users
  // const currentUserIndex =
  //   followers?.findIndex((user: any) => user.id === currentUserId) || 0;
  // const prevUserId =
  //   currentUserIndex > 0 ? followers[currentUserIndex - 1]?.id : null;
  // const nextUserId =
  //   currentUserIndex < followers?.length - 1
  //     ? followers[currentUserIndex + 1]?.id
  //     : null;

  // Video state management
  const videoData = useRef<any[]>([]);
  const indexRef = useRef(0);
  const [videos, setVideos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController[]>([]);
  const [hearts, setHearts] = useState<number[]>([]);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [countNumber, setCountNumber] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const { data: config } = useGetConfigQuery({});
  const [isDecrypting, setIsDecrypting] = useState(true);

  // // Touch/swipe state for user navigation
  // const swipeThreshold = 80; // minimum distance for swipe
  // const swipeDirectionThreshold = 0.7; // ratio to determine if swipe is more horizontal than vertical

  // // Touch tracking refs
  // const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
  //   null
  // );
  // const isSwipingRef = useRef(false);
  // const swipeDetectedRef = useRef(false);

  // Add at the top of your component
  const decryptionCache = useRef(new Map<string, string>());

  const removeHeart = (id: number) => {
    setHearts((prev) => prev.filter((heartId) => heartId !== id));
  };

  // Add decryption cache to speed up repeated decryption calls
  const decryptThumbnail = async (thumbnail: string): Promise<string> => {
    if (!thumbnail) return "";

    // Check cache first
    if (decryptionCache.current.has(thumbnail)) {
      return decryptionCache.current.get(thumbnail) || "";
    }

    // If it's not a .txt file, cache and return as-is
    if (!thumbnail.endsWith(".txt")) {
      decryptionCache.current.set(thumbnail, thumbnail);
      return thumbnail;
    }

    try {
      const decryptedUrl = await decryptImage(thumbnail);
      decryptionCache.current.set(thumbnail, decryptedUrl);
      return decryptedUrl;
    } catch (error) {
      console.error("Error decrypting thumbnail:", error);
      return "";
    }
  };

  // // Handle swipe navigation between users
  // const handleSwipeNavigation = (direction: "left" | "right") => {
  //   if (isTransitioning) return;

  //   let targetUserId = null;

  //   if (direction === "left" && nextUserId) {
  //     targetUserId = nextUserId;
  //   } else if (direction === "right" && prevUserId) {
  //     targetUserId = prevUserId;
  //   }

  //   if (targetUserId) {
  //     console.log(`🔄 Navigating ${direction} to user: ${targetUserId}`);
  //     setIsTransitioning(true);
  //     setCurrentUserId(targetUserId);
  //     setCurrentIndex(0); // Reset video index when switching users
  //     indexRef.current = 0;

  //     // Update URL without full navigation to maintain state
  //     window.history.replaceState(null, "", `/story_detail/${targetUserId}`);

  //     setTimeout(() => {
  //       setIsTransitioning(false);
  //     }, 300);
  //   } else {
  //     console.log(
  //       `❌ No ${direction === "left" ? "next" : "previous"} user available`
  //     );
  //   }
  // };

  // // Document-level touch handling that bypasses all component interference
  // useEffect(() => {
  //   const handleDocumentTouchStart = (e: TouchEvent) => {
  //     // Only handle touches within our myday container
  //     const container = videoContainerRef.current;
  //     if (!container || !container.contains(e.target as Node)) return;

  //     const touch = e.touches[0];
  //     touchStartRef.current = {
  //       x: touch.clientX,
  //       y: touch.clientY,
  //       time: Date.now(),
  //     };
  //     isSwipingRef.current = false;
  //     swipeDetectedRef.current = false;

  //     console.log("📱 Touch start detected:", {
  //       x: touch.clientX,
  //       y: touch.clientY,
  //       target: e.target,
  //     });
  //   };

  //   const handleDocumentTouchMove = (e: TouchEvent) => {
  //     if (!touchStartRef.current) return;

  //     // Only handle touches within our myday container
  //     const container = videoContainerRef.current;
  //     if (!container || !container.contains(e.target as Node)) return;

  //     const touch = e.touches[0];
  //     const deltaX = touch.clientX - touchStartRef.current.x;
  //     const deltaY = touch.clientY - touchStartRef.current.y;
  //     const absDeltaX = Math.abs(deltaX);
  //     const absDeltaY = Math.abs(deltaY);

  //     // Detect if this is a horizontal swipe
  //     if (
  //       absDeltaX > 30 &&
  //       absDeltaX > absDeltaY * (1 / swipeDirectionThreshold)
  //     ) {
  //       if (!isSwipingRef.current) {
  //         console.log("🔄 Horizontal swipe detected");
  //         isSwipingRef.current = true;
  //       }
  //     }
  //   };

  //   const handleDocumentTouchEnd = (e: TouchEvent) => {
  //     if (!touchStartRef.current) return;

  //     // Only handle touches within our myday container
  //     const container = videoContainerRef.current;
  //     if (!container || !container.contains(e.target as Node)) {
  //       touchStartRef.current = null;
  //       isSwipingRef.current = false;
  //       swipeDetectedRef.current = false;
  //       return;
  //     }

  //     const touch = e.changedTouches[0];
  //     const deltaX = touch.clientX - touchStartRef.current.x;
  //     const deltaY = touch.clientY - touchStartRef.current.y;
  //     const absDeltaX = Math.abs(deltaX);
  //     const absDeltaY = Math.abs(deltaY);
  //     const timeDiff = Date.now() - touchStartRef.current.time;

  //     console.log("📱 Touch end analysis:", {
  //       deltaX,
  //       deltaY,
  //       absDeltaX,
  //       absDeltaY,
  //       timeDiff,
  //       meetsDistance: absDeltaX > swipeThreshold,
  //       isHorizontal: absDeltaX > absDeltaY * (1 / swipeDirectionThreshold),
  //       isQuick: timeDiff < 800,
  //       prevUserId,
  //       nextUserId,
  //     });

  //     // Check if this qualifies as a user navigation swipe
  //     if (
  //       absDeltaX > swipeThreshold &&
  //       absDeltaX > absDeltaY * (1 / swipeDirectionThreshold) &&
  //       timeDiff < 800 &&
  //       !swipeDetectedRef.current
  //     ) {
  //       swipeDetectedRef.current = true;

  //       if (deltaX > 0) {
  //         console.log("👈 Swiping right - going to previous user");
  //         handleSwipeNavigation("right");
  //       } else {
  //         console.log("👉 Swiping left - going to next user");
  //         handleSwipeNavigation("left");
  //       }
  //     }

  //     // Clean up
  //     touchStartRef.current = null;
  //     isSwipingRef.current = false;
  //     swipeDetectedRef.current = false;
  //   };

  //   // Add event listeners to document to bypass all component interference
  //   document.addEventListener("touchstart", handleDocumentTouchStart, {
  //     passive: true,
  //   });
  //   document.addEventListener("touchmove", handleDocumentTouchMove, {
  //     passive: true,
  //   });
  //   document.addEventListener("touchend", handleDocumentTouchEnd, {
  //     passive: true,
  //   });

  //   return () => {
  //     document.removeEventListener("touchstart", handleDocumentTouchStart);
  //     document.removeEventListener("touchmove", handleDocumentTouchMove);
  //     document.removeEventListener("touchend", handleDocumentTouchEnd);
  //   };
  // }, [currentUserId, nextUserId, prevUserId, isTransitioning]); // Re-setup when users change

  // Refetch data when currentUserId changes
  // useEffect(() => {
  //   if (currentUserId) {
  //     refetch();
  //   }
  // }, [currentUserId, refetch]);

  useEffect(() => {
    // Determine which data corresponds to the current tab
    const currentData = data?.data;

    if (currentData) {
      if (currentData?.length > 0) {
        try {
          const decryptAndUpdateVideos = async () => {
            const decryptedVideos = await Promise.all(
              currentData?.map(async (video: any) => ({
                ...video,
                decryptedPreview: await decryptThumbnail(video.preview_image),
              }))
            );
            // Find the first unwatched video or default to 0
            const firstUnwatchedIndex = decryptedVideos.findIndex(
              (video) => !video.user?.my_day?.watched
            );
            const newIndex = firstUnwatchedIndex >= 0 ? firstUnwatchedIndex : 0;

            setCurrentIndex(newIndex);
            setVideos(decryptedVideos);
            setIsDecrypting(false);
          };
          decryptAndUpdateVideos();
        } catch (error) {
          setIsDecrypting(false);
        }
      } else {
        setIsDecrypting(false);
      }
    }
  }, [data?.data]);

  const video = videos[currentIndex] || null; // Get the current video based on index

  const [watchedPosts, setWatchedPosts] = useState<Record<string, boolean>>({});

  // Modify your watchPost effect like this:
  useEffect(() => {
    try {
      if (
        video &&
        !video?.user?.my_day?.watched &&
        !watchedPosts[video.post_id]
      ) {
        // Watch the post when the video changes
        watchPost({ post_id: video.post_id })
          .unwrap()
          .then(() => {
            // Mark as watched on success
            setWatchedPosts((prev) => ({ ...prev, [video.post_id]: true }));
          })
          .catch((error) => {
            console.error("Error watching post:", error);
          });
      }
    } catch (error) {
      console.error("Error watching post:", error);
    }
  }, [video, watchedPosts]);

  console.log(isDecrypting);
  return (
    <div
      ref={videoContainerRef}
      className="myday_container"
      // className={`myday_container ${isTransitioning ? "transitioning" : ""}`}
    >
      {isDecrypting && (
        <div className="app bg-[#16131C]">
          <div
            style={{
              textAlign: "center",
              padding: "20px",
            }}
          >
            <div>
              <LoadingBar />
            </div>
            <div className="heart">
              <img src={loader} className="w-[100px] h-[100px]" alt="Loading" />
            </div>
          </div>
        </div>
      )}
      {video && (
        <div
          className={`video justify-center items-center overflow-hidden`}
          data-post-id={video?.post_id} // Add post ID to the container
        >
          {video?.file_type !== "video" ? (
            <a
              href={video?.ads_info?.jump_url}
              target="_blank"
              className="flex items-center justify-center h-full overflow-hidden"
            >
              <img
                src={video?.files[0]?.resourceURL}
                alt=""
                className="w-full mx-auto"
              />
            </a>
          ) : (
            <DetailContainer
              setIsDecrypting={setIsDecrypting}
              refetch={refetch}
              length={videos.length}
              currentIndex={currentIndex}
              setCurrentIndex={setCurrentIndex}
              videoData={videoData}
              indexRef={indexRef}
              abortControllerRef={abortControllerRef}
              container={videoContainerRef.current}
              status={true}
              countNumber={countNumber}
              video={video}
              setCountNumber={setCountNumber}
              config={config}
              countdown={countdown}
              setWidth={setWidth}
              setHeight={setHeight}
              setHearts={setHearts}
              setCountdown={setCountdown}
              width={width}
              height={height}
            />
          )}

          {video?.type !== "ads" && video?.type !== "ads_virtual" && (
            <VideoFooter
              badge={video?.user?.badge}
              id={video?.user?.id}
              tags={video?.tag}
              title={video?.title}
              username={video?.user?.name}
              city={video?.city}
            />
          )}

          {(video?.type === "ads" || video?.type === "ads_virtual") && (
            <Ads ads={video?.ads_info} type={video?.type} />
          )}

          {hearts.map((id: any) => (
            <HeartCount id={id} key={id} remove={removeHeart} />
          ))}
        </div>
      )}

      {/* Visual indicators for available swipe directions with better visibility */}
      {/* {!isDecrypting && (
        <>
          {prevUserId && (
            <div className="swipe-indicator left">
   
              <div
                style={{
                  position: "absolute",
                  top: "50px",
                  left: "0",
                  color: "white",
                  fontSize: "12px",
                  background: "rgba(0,0,0,0.7)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                }}
              >
            
              </div>
            </div>
          )}
          {nextUserId && (
            <div className="swipe-indicator right">

              <div
                style={{
                  position: "absolute",
                  top: "50px",
                  right: "0",
                  color: "white",
                  fontSize: "12px",
                  background: "rgba(0,0,0,0.7)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                }}
              >

              </div>
            </div>
          )}

         
        </>
      )} */}
    </div>
  );
};

export default Detail;

{
  /* Debug info */
}
{
  /* <div
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              color: "white",
              fontSize: "10px",
              background: "rgba(0,0,0,0.8)",
              padding: "4px 8px",
              borderRadius: "4px",
              zIndex: 1001,
            }}
          >
            Current: {currentUserId} | Prev: {prevUserId || "none"} | Next:{" "}
            {nextUserId || "none"}
          </div> */
}
