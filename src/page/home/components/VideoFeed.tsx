import React, { useEffect, useRef, useState } from "react";
import { useGetConfigQuery, usePostCommentMutation } from "../services/homeApi";
import { useDispatch, useSelector } from "react-redux";
import FeedFooter from "./FeedFooter";
import { useNavigate } from "react-router-dom";
import HeartCount from "./Heart";
import { showToast } from "../services/errorSlice";
import Ads from "./Ads";
import loader from "../vod_loader.gif";
import LoginDrawer from "@/components/profile/auth/login-drawer";
import sc from "../../../assets/explore/sc.svg";
import VideoContainerFeed from "./VideoContainerFeed";
import { getDeviceInfo } from "@/lib/deviceInfo";
import { decryptImage } from "@/utils/imageDecrypt";
import PreventSwipeBack from "@/components/shared/PreventSwipeBack";
import { Swiper, SwiperSlide } from "swiper/react";
import { Virtual } from "swiper/modules";
import "swiper/css";
import "swiper/css/virtual";

interface Video {
  post_id: string | number;
  file_type: string;
  type: string;
  preview_image: string;
  decryptedPreview?: string;
  files: Array<{ resourceURL: string }>;
  ads_info?: any;
  user?: any;
  tag?: any;
  title?: string;
  city?: string;
}

interface VideoFeedProps {
  videos: Video[];
  currentActiveId: string | number;
  setShowVideoFeed: (show: boolean) => void;
  query: string;
  setVideos: (videos: Video[]) => void;
  setPage: (page: number | ((prev: number) => number)) => void;
  search?: boolean;
}

interface RootState {
  persist: {
    user: any;
  };
  hideBarSlice: {
    hideBar: boolean;
  };
}

const VideoFeed = ({
  videos,
  currentActiveId,
  setShowVideoFeed,
  query,
  setVideos,
  setPage,
  search = false,
}: VideoFeedProps) => {
  const [content, setContent] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [countNumber, setCountNumber] = useState(0);
  const { data: config } = useGetConfigQuery({});
  const user = useSelector((state: RootState) => state.persist.user);
  const { hideBar } = useSelector((state: RootState) => state.hideBarSlice);
  const [postComment] = usePostCommentMutation();
  const navigate = useNavigate();
  const [hearts, setHearts] = useState<number[]>([]);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const abortControllerRef = useRef<AbortController[]>([]);
  const videoData = useRef<any[]>([]);
  const [isDecrypting, setIsDecrypting] = useState(true);
  const [videosToRender, setVideosToRender] = useState<Video[]>([]);
  const swiperRef = useRef<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const decryptionCache = useRef(new Map<string, string>());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const previousVideosLength = useRef(0);
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [currentActivePost, setCurrentActivePost] =
    useState<string | number>(currentActiveId);

  const removeHeart = (id: number) => {
    setHearts((prev) => prev.filter((heartId) => heartId !== id));
  };

  const decryptThumbnail = async (thumbnail: string): Promise<string> => {
    if (!thumbnail) return "";
    if (decryptionCache.current.has(thumbnail)) {
      return decryptionCache.current.get(thumbnail) || "";
    }
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

  useEffect(() => {
    if (videos.length > 0) {
      const run = async () => {
        const videosWithDecryptedPreviews = await Promise.all(
          videos.map(async (video: Video) => ({
            ...video,
            decryptedPreview: await decryptThumbnail(video.preview_image),
          }))
        );
        
        // Check if new videos were added
        const wasLoadingMore = isLoadingMore;
        const previousLength = previousVideosLength.current;
        
        setVideosToRender(videosWithDecryptedPreviews);
        setIsDecrypting(false);
        
        // Auto-advance to next video if we were loading more and new content arrived
        if (wasLoadingMore && videosWithDecryptedPreviews.length > previousLength) {
          // Clear any existing timeout
          if (autoAdvanceTimeoutRef.current) {
            clearTimeout(autoAdvanceTimeoutRef.current);
          }
          
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (swiperRef.current && activeIndex === previousLength - 1) {
              swiperRef.current.slideTo(activeIndex + 1);
            }
            setIsLoadingMore(false);
            autoAdvanceTimeoutRef.current = null;
          }, 500); // Small delay for smooth transition
        }
        
        previousVideosLength.current = videosWithDecryptedPreviews.length;
      };
      run();
    }
    
    // Cleanup function
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    };
  }, [videos, isLoadingMore, activeIndex]);

  useEffect(() => {
    const handlePopState = () => {
      setShowVideoFeed(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (currentActivePost && swiperRef.current && videosToRender.length > 0) {
      const index = videosToRender.findIndex(
        (v) => v.post_id === currentActivePost
      );
      if (index !== -1) {
        swiperRef.current.slideTo(index);
      }
    }
  }, [currentActivePost, videosToRender]);

  useEffect(() => {
    if (activeIndex >= videosToRender.length - 3 && !isLoadingMore) {
      console.log("Loading more videos...");
      setIsLoadingMore(true);
      setPage((prev: number) => prev + 1);
    }
  }, [activeIndex, videosToRender.length, isLoadingMore]);

  console.log(activeIndex, videosToRender.length);

  const handleBack = () => {
    setShowVideoFeed(false);
  };

  const handleComment = async (post_id: string | number) => {
    if (user?.token) {
      if (!content.trim()) return;
      try {
        const deviceInfo = getDeviceInfo();
        const response = await postComment({
          post_id: post_id,
          content: content,
          device: deviceInfo.deviceName,
          app_version: deviceInfo.appVersion,
        }).unwrap();
        setContent("");
        dispatch(
          showToast({
            message: response?.message || "Comment posted successfully",
            type: "success",
          })
        );
      } catch (error: any) {
        dispatch(
          showToast({
            message: error?.data?.message || "Failed to post comment",
            type: "error",
          })
        );
        console.error("Failed to post reply:", error);
      }
    } else {
      setIsOpen(true);
    }
  };

  const handleSearch = () => {
    navigate("/search_overlay");
  };

  const handleSlideChange = (swiper: any) => {
    setActiveIndex(swiper.activeIndex);
    const currentVideo = videosToRender[swiper.activeIndex];
    if (currentVideo) {
      setCurrentActivePost(currentVideo.post_id);
      setCountdown(3);
      setCountNumber(0);
    }
  };

  return (
    <>
      <LoginDrawer isOpen={isOpen} setIsOpen={setIsOpen} />
      <div className="app_feed bg-black">
        {!search && <PreventSwipeBack />}

        {isDecrypting ? (
          <div className="app bg-[#16131C]">
            <div style={{ textAlign: "center", padding: "20px" }}>
              <div className="heart">
                <img
                  src={loader}
                  className="w-[100px] h-[100px]"
                  alt="Loading"
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`${isOpen ? "opacity-50" : ""}`}
            style={{ pointerEvents: isOpen ? "none" : "auto" }}
          >
            <div
              className="fixed top-3 left-0 flex gap-2 items-center w-full z-[9999]"
              style={{ display: hideBar ? "none" : "flex" }}
            >
              <button className="p-3" onClick={handleBack}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="14"
                  viewBox="0 0 10 14"
                  fill="none"
                >
                  <path
                    d="M8.95748 0.326623C8.85923 0.243209 8.74251 0.17703 8.61401 0.131875C8.48551 0.0867197 8.34775 0.0634766 8.20863 0.0634766C8.06951 0.0634766 7.93175 0.0867197 7.80325 0.131875C7.67475 0.17703 7.55803 0.243209 7.45978 0.326623L0.428239 6.28126C0.349798 6.34756 0.287565 6.4263 0.245104 6.51298C0.202642 6.59967 0.180786 6.69259 0.180786 6.78644C0.180786 6.88029 0.202642 6.97321 0.245104 7.0599C0.287565 7.14658 0.349798 7.22533 0.428239 7.29162L7.45978 13.2463C7.8744 13.5974 8.54286 13.5974 8.95748 13.2463C9.37209 12.8951 9.37209 12.3291 8.95748 11.9779L2.83132 6.78286L8.96594 1.58777C9.37209 1.24382 9.37209 0.670574 8.95748 0.326623Z"
                    fill="white"
                  />
                </svg>
              </button>
              <div className="relative flex-1 mr-5">
                <div className="absolute top-2 left-3">
                  <img src={sc} alt="" />
                </div>
                <input
                  className="feed-input w-full pl-[45px] py-[8px]"
                  placeholder={query}
                  onClick={handleSearch}
                />
              </div>
            </div>

            <Swiper
              direction="vertical"
              modules={[Virtual]}
              virtual
              className=" w-full video-feed-swiper"
              onSwiper={(swiper) => (swiperRef.current = swiper)}
              onSlideChange={handleSlideChange}
              initialSlide={videosToRender.findIndex(
                (v) => v.post_id === currentActivePost
              )}
            >
              {videosToRender.map((video, index) => (
                <SwiperSlide key={video.post_id} virtualIndex={index}>
                  <div
                    className="video1 pb-[70px] w-full relative"
                    data-post-id={video.post_id}
                  >
                    {video?.file_type !== "video" ? (
                      <a
                        href={video?.ads_info?.jump_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={video?.files[0]?.resourceURL}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ) : (
                      <VideoContainerFeed
                        setVideosData={setVideos}
                        setrenderVideos={setVideosToRender}
                        videoData={videoData}
                        indexRef={{ current: index }}
                        abortControllerRef={abortControllerRef}
                        container={null}
                        width={width}
                        height={height}
                        status={index === activeIndex}
                        countNumber={countNumber}
                        video={video}
                        setCountNumber={setCountNumber}
                        config={config}
                        countdown={countdown}
                        setWidth={setWidth}
                        setHeight={setHeight}
                        setHearts={setHearts}
                        setCountdown={setCountdown}
                      />
                    )}

                    {video?.type !== "ads" && video?.type !== "ads_virtual" && (
                      <FeedFooter
                        badge={video?.user?.badge}
                        id={video?.user?.id}
                        tags={video?.tag}
                        title={video?.title}
                        username={video?.user?.name}
                        city={video?.city}
                      />
                    )}

                    {(video?.type === "ads" ||
                      video?.type === "ads_virtual") && (
                      <Ads ads={video?.ads_info} type={video?.type} />
                    )}

                    {hearts.map((id: number) => (
                      <HeartCount id={id} key={id} remove={removeHeart} />
                    ))}

                    <div
                      className="absolute bottom-0 add_comment w-full py-3 z-[9999]"
                      style={{ display: hideBar ? "none" : "block" }}
                    >
                      <div className="flex items-center feed_add_comment gap-2 px-4">
                        <input
                          type="text"
                          className="w-full p-[6px] bg-transparent border-none outline-none"
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="我来说两句～"
                        />
                        <button
                          className="p-3"
                          onClick={() => handleComment(video?.post_id)}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="22"
                            viewBox="0 0 24 22"
                            fill="none"
                          >
                            <path
                              d="M12.2705 11.7305L3.00345 12.6274L0.56437 20.427C0.468914 20.7295 0.496117 21.0574 0.640043 21.3401C0.783968 21.6227 1.03349 21.8374 1.33422 21.9378C1.63518 22.0382 1.96335 22.0164 2.24826 21.8772L22.5589 12.0422C22.8198 11.9151 23.0233 11.6943 23.1289 11.424C23.2345 11.1537 23.2345 10.8535 23.1289 10.5832C23.0233 10.3129 22.8198 10.0921 22.5589 9.96495L2.26219 0.123036C1.97731 -0.0164383 1.64889 -0.038204 1.34796 0.0622005C1.04724 0.162848 0.797965 0.377508 0.65378 0.659921C0.509855 0.94258 0.482651 1.2705 0.578108 1.57295L3.01719 9.37255L12.2672 10.2695C12.6408 10.3066 12.9257 10.6209 12.9257 10.9963C12.9257 11.3719 12.6408 11.6862 12.2672 11.7231L12.2705 11.7305Z"
                              fill="white"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  {(activeIndex === videosToRender.length - 1 || isLoadingMore) && (
                    <div className="flex justify-center items-center p-3 w-full z-[99999]">
                      <img
                        src={loader}
                        className="w-[80px] h-[80px]"
                        alt="Loading"
                      />
                    </div>
                  )}
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        )}
      </div>
    </>
  );
};

export default React.memo(VideoFeed);
