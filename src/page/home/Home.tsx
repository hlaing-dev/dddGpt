import { useEffect, memo, useRef, useState } from "react";
import SwipeableViews from "react-swipeable-views-react-18-babel-version-fix";
import { virtualize } from "react-swipeable-views-utils-babel-version-fix";
import { mod } from "react-swipeable-views-core-babel-version-fix";

import {
  useGetConfigQuery,
  useGetFollowedPostsQuery,
  useGetPostsQuery,
} from "./services/homeApi";
import loader from "./vod_loader.gif";
import VideoFooter from "./components/VideoFooter";
import Top20Movies from "./components/Top20Movies";
import TopNavbar from "./components/TopNavbar";
import Explorer from "../explore/Explore";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentTab } from "./services/homeSlice";
import { setCurrentActivePost } from "./services/activeSlice";
import { setVideos } from "./services/videosSlice";
import { setPage } from "./services/pageSlice";
import HeartCount from "./components/Heart";
import VideoContainer from "./components/VideoContainer";
import Ads from "./components/Ads";
import { decryptImage } from "@/utils/imageDecrypt";

// Define types for Redux state
interface RootState {
  activeslice: {
    currentActivePost: string | null;
  };
  videoSlice: {
    videos: {
      follow: VideoItem[];
      foryou: VideoItem[];
      [key: string]: VideoItem[] | undefined;
    };
  };
  pageSlice: {
    page: number;
  };
  home: {
    currentTab: number;
  };
}

// Define types for video items
interface VideoItem {
  post_id: string;
  user: {
    badge: string;
    id: string;
    name: string;
  };
  tag: string[];
  title: string;
  city: string;
  type: string;
  file_type: string;
  files: Array<{
    resourceURL: string;
  }>;
  preview_image: string;
  decryptedPreview?: string;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  ads_info?: {
    jump_url: string;
  };
}

const VirtualizedSwipeableViews = virtualize(SwipeableViews);

const Home = () => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  // We access currentActivePost but don't use it directly, using it for side effects via dispatch
  useSelector((state: RootState) => state.activeslice.currentActivePost);
  const { videos } = useSelector((state: RootState) => state.videoSlice);
  const { page } = useSelector((state: RootState) => state.pageSlice);

  const [countdown, setCountdown] = useState(3);
  const [countNumber, setCountNumber] = useState(0);
  const [topmovies, setTopMovies] = useState(false);
  const currentTab = useSelector((state: RootState) => state.home.currentTab);
  const [refresh, setRefresh] = useState(false);
  const dispatch = useDispatch();
  const [hearts, setHearts] = useState<number[]>([]);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const abortControllerRef = useRef<AbortController[]>([]);
  const videoData = useRef<HTMLVideoElement[]>([]);
  const indexRef = useRef(0);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [swipeIndex, setSwipeIndex] = useState(1); // Current center position
  const [swipeTransition, setSwipeTransition] = useState(true);

  const {
    data: config,
    isLoading: isConfigLoading,
    isError: isConfigError,
  } = useGetConfigQuery({});
  const {
    data: followData,
    isFetching: isFollowFetching,
    refetch: followRefetch,
    isError: followError,
  } = useGetFollowedPostsQuery({ page }, { skip: currentTab !== 0 });
  const {
    data: forYouData,
    isFetching: isForYouFetching,
    refetch: forYouRefetch,
    isError: forYouError,
  } = useGetPostsQuery({ page }, { skip: currentTab !== 2 });

  const isLoading =
    isConfigLoading ||
    (currentTab === 0 && isFollowFetching) ||
    (currentTab === 2 && isForYouFetching);
  const isError = isConfigError || followError || forYouError;

  const [videoIndices, setVideoIndices] = useState({
    follow: 0,
    foryou: 0,
  });

  const currentVideoIndex =
    videoIndices[currentTab === 2 ? "foryou" : "follow"];
  const currentVideos = videos[currentTab === 2 ? "foryou" : "follow"] || [];

  const setCurrentVideoIndex = (index: number) => {
    setVideoIndices((prev) => ({
      ...prev,
      [currentTab === 2 ? "foryou" : "follow"]: index,
    }));
  };

  const decryptionCache = useRef(new Map<string, string>());

  const decryptThumbnail = async (thumbnail: string): Promise<string> => {
    if (!thumbnail) return "";
    if (decryptionCache.current.has(thumbnail))
      return decryptionCache.current.get(thumbnail) || "";
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

  // Update visible items when videos or index changes
  useEffect(() => {
    if (currentVideos.length > 0) {
      dispatch(setCurrentActivePost(currentVideos[currentVideoIndex]?.post_id));
    }
  }, [currentVideos, currentVideoIndex]);

  useEffect(() => {
    const currentData =
      currentTab === 0 ? followData : currentTab === 2 ? forYouData : null;
    if (currentData?.data) {
      const videoKey =
        currentTab === 0 ? "follow" : currentTab === 2 ? "foryou" : "";
      const filteredData = currentData.data.filter(
        (newPost: VideoItem) =>
          !videos[videoKey]?.some(
            (video: VideoItem) => video?.post_id === newPost?.post_id
          )
      );

      if (page === 1) setIsDecrypting(true);

      if (filteredData?.length > 0) {
        const decryptAndUpdateVideos = async () => {
          const decryptedVideos = await Promise.all(
            filteredData.map(async (video: VideoItem) => ({
              ...video,
              decryptedPreview: await decryptThumbnail(video.preview_image),
            }))
          );

          if (page === 1) {
            dispatch(setVideos({ ...videos, [videoKey]: decryptedVideos }));
          } else {
            dispatch(
              setVideos({
                ...videos,
                [videoKey]: [...(videos[videoKey] || []), ...decryptedVideos],
              })
            );
          }
          setIsDecrypting(false);
        };
        decryptAndUpdateVideos();
      } else {
        setIsDecrypting(false);
      }
    }
  }, [followData, forYouData, currentTab, page]);

  // Handle swipe change
  const handleSwipeChange = (index: number) => {
    setSwipeIndex(index);
  };

  // Optimize swipe handling with proper debouncing
  useEffect(() => {
    // Using a ref to track if a transition is in progress to prevent multiple transitions
    const transitionTimer = setTimeout(() => {
      if (swipeIndex === 0 && currentVideoIndex > 0) {
        // Swipe Up - smoothly change to previous video
        setSwipeTransition(false);
        setCurrentVideoIndex(currentVideoIndex - 1);

        setSwipeIndex(1);
        requestAnimationFrame(() => {
          setTimeout(() => setSwipeTransition(true), 10);
        });
      } else if (
        swipeIndex === 2 &&
        currentVideoIndex < currentVideos.length - 1
      ) {
        // Swipe Down - smoothly change to next video
        setSwipeTransition(false);
        setCurrentVideoIndex(currentVideoIndex + 1);

        setSwipeIndex(1);
        requestAnimationFrame(() => {
          setTimeout(() => setSwipeTransition(true), 10);
        });
      } else if (swipeIndex !== 1) {
        // Snap back to center if edge case
        setSwipeIndex(1);
      }
    }, 50); // Shorter timeout for more responsive feel

    return () => clearTimeout(transitionTimer);
  }, [swipeIndex, currentVideoIndex, currentVideos.length]);

  // Modified slide renderer to optimize performance
  const slideRenderer = ({ index, key }: { index: number; key: number }) => {
    // Only render the current, previous, and next video for better performance
    if (index < 0 || index > 2) return null;

    const videoIndex = mod(currentVideoIndex + index - 1, currentVideos.length);
    const item = currentVideos[videoIndex];

    if (!item) return null;

    const isActive = index === 1;

    // Create a stable content without use of useMemo (which doesn't work in this context)
    const content = (
      <div className="w-full h-full relative">
        <div
          style={{
            display: item.file_type !== "video" ? "block" : "none",
          }}
          onClick={() => window.open(item?.ads_info?.jump_url, "_blank")}
          className="w-full h-full relative"
        >
          <img
            src={item?.files[0]?.resourceURL}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        <div className="w-full h-full">
          <div className="w-full h-full">
            <div
              className="w-full h-full relative"
              style={{
                display: item.file_type !== "video" ? "none" : "block",
              }}
            >
              <VideoContainer
                videoData={videoData}
                indexRef={indexRef}
                abortControllerRef={abortControllerRef}
                container={videoContainerRef.current}
                status={true}
                countNumber={countNumber}
                video={item}
                setCountNumber={setCountNumber}
                config={config}
                countdown={countdown}
                setWidth={setWidth}
                setHeight={setHeight}
                setHearts={setHearts}
                setCountdown={setCountdown}
                width={width}
                height={height}
                isActiveState={isActive}
              />
            </div>

            {item?.type !== "ads" && item?.type !== "ads_virtual" && (
              <VideoFooter
                badge={item?.user?.badge}
                id={item?.user?.id}
                tags={item?.tag}
                title={item?.title}
                username={item?.user?.name}
                city={item?.city}
              />
            )}

            {(item?.type === "ads" || item?.type === "ads_virtual") && (
              <Ads ads={item?.ads_info} type={item?.type} />
            )}

            {isActive &&
              hearts.map((id: number) => (
                <HeartCount id={id} key={id} remove={removeHeart} />
              ))}
          </div>
        </div>
      </div>
    );

    return (
      <div
        key={key}
        style={{
          height: "calc(100dvh - 76px)",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {content}
      </div>
    );
  };

  // Load more videos when nearing the end - with improved performance
  useEffect(() => {
    // Only trigger the load more when we're 2 away from the end instead of 3
    if (
      currentVideoIndex >= currentVideos.length - 5 &&
      !isLoading &&
      !isDecrypting &&
      currentVideos.length > 0
    ) {
      dispatch(setPage(page + 1));
    }
  }, [currentVideoIndex, currentVideos.length, isLoading, isDecrypting]);

  const handleTabClick = (tab: number) => {
    if (currentTab !== tab) {
      dispatch(setCurrentTab(tab));
    } else {
      setRefresh(true);
    }
  };

  const handleRefresh = () => {
    const videoKey = currentTab === 2 ? "foryou" : "follow";
    dispatch(setPage(1));
    dispatch(setCurrentActivePost(null));
    dispatch(setVideos({ ...videos, [videoKey]: [] }));
    if (currentTab === 2) forYouRefetch();
    else if (currentTab === 0) followRefetch();
    setCurrentVideoIndex(0);
  };

  const removeHeart = (id: number) => {
    setHearts((prev) => prev.filter((heartId) => heartId !== id));
  };

  if (topmovies) {
    return <Top20Movies setTopMovies={setTopMovies} />;
  }

  return (
    <div className="flex justify-center items-center">
      <div className="max-w-[1024px] home-main w-full ">
        <TopNavbar currentTab={currentTab} onTabClick={handleTabClick} />

        <div className="app bg-black h-full w-full">
          {isDecrypting && (
            <div className="app bg-black">
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
          )}

          {refresh ? (
            <div className="bg-black rounded-xl px-4 py-0">
              <img src={loader} alt="" width={50} height={50} />
            </div>
          ) : (
            <>
              {currentTab !== 1 &&
                (isLoading && currentVideos.length === 0 ? (
                  <div className="app bg-black">
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
                  !isError &&
                  currentVideos.length > 0 && (
                    <div className="app__videos relative">
                      <VirtualizedSwipeableViews
                        axis="y"
                        index={swipeIndex}
                        onChangeIndex={handleSwipeChange}
                        slideCount={3}
                        slideRenderer={slideRenderer}
                        enableMouseEvents
                        resistance
                        animateTransitions={swipeTransition}
                        style={{
                          height: "calc(100dvh - 76px)",
                          width: "100%",
                        }}
                        containerStyle={{
                          height: "calc(100dvh - 76px)",
                          width: "100%",
                          willChange: "transform", // Add this to improve performance
                        }}
                        slideStyle={{
                          height: "calc(100dvh - 76px)",
                          width: "100%",
                        }}
                      />
                    </div>
                  )
                ))}

              {isError && (
                <div className="app bg-black">
                  <div style={{ textAlign: "center", padding: "20px" }}>
                    <div className="text-white flex flex-col justify-center items-center gap-2">
                      <div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="33"
                          height="33"
                          viewBox="0 0 33 33"
                          fill="none"
                        >
                          <path
                            d="M24.4993 28.7502C24.4993 25.9212 23.3755 23.2081 21.3752 21.2077C19.3748 19.2073 16.6617 18.0835 13.8327 18.0835C11.0037 18.0835 8.2906 19.2073 6.29021 21.2077C4.28982 23.2081 3.16602 25.9212 3.16602 28.7502"
                            stroke="#888888"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M13.8327 18.0833C17.5146 18.0833 20.4993 15.0986 20.4993 11.4167C20.4993 7.73477 17.5146 4.75 13.8327 4.75C10.1508 4.75 7.16602 7.73477 7.16602 11.4167C7.16602 15.0986 10.1508 18.0833 13.8327 18.0833Z"
                            stroke="#888888"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <div className="follow-error">关注您喜欢的作者</div>
                    </div>
                  </div>
                </div>
              )}

              {currentTab === 1 && (
                <div className="w-screen">
                  <Explorer />
                </div>
              )}

              {isError && (
                <div className="app bg-black">
                  <div style={{ textAlign: "center", padding: "20px" }}>
                    <div className="text-white flex flex-col justify-center items-center gap-2">
                      <div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="32"
                          height="33"
                          viewBox="0 0 32 33"
                          fill="none"
                        >
                          <path
                            d="M11.4031 4.62095L11.403 4.62082C14.0022 3.54025 16.8802 3.35193 19.5939 4.08509C22.3076 4.81823 24.7089 6.43272 26.4261 8.68014L26.4263 8.68032C26.4937 8.76877 26.5718 8.84833 26.6556 8.91565L27.2033 9.35581L26.5006 9.36052L21.7383 9.39246C20.9726 9.39847 20.3567 10.0226 20.3627 10.7872L20.3627 10.7877C20.3672 11.5526 20.9924 12.1689 21.7575 12.1629L21.7578 12.1629L29.9185 12.1079L29.9188 12.1079M11.4031 4.62095L31.5441 10.6738C31.5566 11.1139 31.3915 11.5398 31.0863 11.8574C30.7811 12.1751 30.3605 12.3543 29.9205 12.3579L29.9188 12.1079M11.4031 4.62095C8.80635 5.69987 6.62978 7.61268 5.21499 10.066C3.80005 12.5178 3.22479 15.3727 3.57938 18.1896C3.93397 21.0065 5.19865 23.6248 7.17475 25.6426L7.17484 25.6426C9.15302 27.6604 11.732 28.9637 14.5143 29.3547C17.2967 29.7475 20.1293 29.2043 22.578 27.8108L22.5781 27.8107C25.0249 26.417 26.9521 24.2493 28.0576 21.6402C28.3569 20.9349 29.1703 20.6058 29.8752 20.905L29.8755 20.905C30.5785 21.2025 30.9079 22.0155 30.6087 22.7208L30.6086 22.7209C29.2671 25.888 26.9264 28.5235 23.9488 30.2193C20.9694 31.9151 17.5185 32.5769 14.1274 32.0984L14.1273 32.0984C10.7378 31.6215 7.59926 30.0339 5.19598 27.5819C2.79267 25.1299 1.25895 21.9508 0.829223 18.5357C0.399503 15.1204 1.09649 11.6584 2.81532 8.68015L2.81534 8.68011C4.53244 5.70358 7.17669 3.37559 10.341 2.06238L10.3411 2.06233C13.5054 0.747344 17.01 0.518603 20.3157 1.41094M11.4031 4.62095L31.2942 10.6809C31.5566 11.1139 31.3915 11.5398 31.0863 11.8574C30.7811 12.1751 30.3605 12.3543 29.9205 12.3579L29.9188 12.1079M11.4031 4.62095L31.2942 10.6809M29.9188 12.1079C30.2921 12.1048 30.648 11.9527 30.9061 11.6842C31.165 11.4147 31.3048 11.0538 31.2942 10.6809M29.9188 12.1079L31.2942 10.6809M31.2942 10.6809L31.0405 2.09452C31.0179 1.33093 30.3788 0.728074 29.6155 0.750614L29.6155 0.750615C28.8505 0.773158 28.2491 1.41193 28.2716 2.17735L28.2716 2.1774L28.3834 5.99257L28.4037 6.68592L27.9458 6.16495C25.9267 3.8682 23.2757 2.21083 20.3157 1.41094M20.3157 1.41094C20.3157 1.41095 20.3157 1.41095 20.3157 1.41096L20.3809 1.16961L20.3157 1.41094ZM20.1127 10.7892C20.118 11.6924 20.8562 12.42 21.7594 12.4129L21.7364 9.14247C20.8331 9.14956 20.1056 9.88598 20.1127 10.7892Z"
                            fill="white"
                            stroke="#16131C"
                            strokeWidth="0.5"
                          />
                        </svg>
                      </div>
                      <div className="text-white">网络连接失败，点击重试</div>
                      <div className="follow-error">加载失败，请稍后重试</div>
                      <button
                        onClick={handleRefresh}
                        className="refreshBtn px-5 py-1"
                      >
                        重试
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(Home);
