import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { usePostsSearchMutation } from "@/store/api/profileApi";
import { ChevronLeft, Search } from "lucide-react";
import { FaSearch } from "react-icons/fa";
import VideoCard from "../video-card";
import InfinitLoad from "@/components/shared/infinit-load";
import loader from "@/page/home/vod_loader.gif";
import { useSearchParams } from "react-router-dom";
import VideoFeed from "@/page/home/components/VideoFeed";
import InfiniteLoad2 from "@/components/shared/infinite-load2";

export function isWebView() {
  return (
    (window as any).webkit &&
    (window as any).webkit.messageHandlers &&
    (window as any).webkit.messageHandlers.jsBridge
  );
}

const SearchVideo = ({ id }: { id: string }) => {
  const [vh, setVh] = useState("100vh");
  const [postsSearch, { isLoading }] = usePostsSearchMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("query") || "";
  const [search, setSearch] = useState<string>(initialQuery);
  const [videos, setVideos] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalData, setTotalData] = useState<number>(0);
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [showVideoFeed, setShowVideoFeed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);

  const searchHandler = async () => {
    setIsLoadingInitial(true);
    setPage(1);
    if (search.trim() !== "") {
      // Update URL search params
      const params = new URLSearchParams(searchParams);
      params.set("query", search.trim());
      setSearchParams(params);

      const { data } = await postsSearch({ page: 1, search, user_id: id });
      const newVideos = data?.data?.list ?? [];
      setVideos(newVideos);
      setTotalData(data?.pagination?.total ?? 0);
      setHasMore(
        newVideos.length > 0 &&
          newVideos.length < (data?.pagination?.total ?? 0)
      );
      setIsLoadingInitial(false);
    } else {
      setVideos([]);
      setTotalData(0);
      setHasMore(false);
      // Clear query param if search is empty
      const params = new URLSearchParams(searchParams);
      params.delete("query");
      setSearchParams(params);
      setIsLoadingInitial(false);
    }
  };

  const fetchMoreData = async () => {
    if (!hasMore || isLoading) return;

    const nextPage = page + 1;
    const { data } = await postsSearch({
      page: nextPage,
      search,
      user_id: id,
    });
    const newVideos = data?.data?.list ?? [];
    setVideos((prev) => [...prev, ...newVideos]);
    setPage(nextPage);
    setHasMore(newVideos.length > 0);
  };

  useEffect(() => {
    setVh(isWebView() ? "100vh" : "100dvh");
  }, []);

  // Initial search when component mounts with query param
  useEffect(() => {
    if (initialQuery) {
      searchHandler();
    }
  }, []); // Empty dependency array ensures this runs only on mount

  return (
    <div className={`${showVideoFeed ? "z-[9900] relative h-screen" : ""}`}>
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerTrigger>
          <div className="bg-[#FFFFFF1F] w-10 h-10 flex justify-center items-center p-2 rounded-full">
            <Search size={18} />
          </div>
        </DrawerTrigger>

        {showVideoFeed && selectedMovieId ? (
          <div className="z-[9999] h-screen fixed top-0 overflow-y-scroll left-0 w-full">
            <VideoFeed
              setPage={setPage}
              setVideos={setVideos}
              videos={videos}
              currentActiveId={selectedMovieId}
              setShowVideoFeed={setShowVideoFeed}
              query={search}
              onClose={() => {
                setShowVideoFeed(false);
                setIsDrawerOpen(true);
              }}
            />
          </div>
        ) : (
          <DrawerContent
            className={`z-[8900] border-0 `}
            style={{ height: vh }}
          >
            <>
              <div
                className="c-height w-full overflow-y-scroll hide-sb"
                id="scrollableSearchDiv"
              >
                <div className=" px-5 z-[8000]  bg-[#16131C] sticky top-0 py-5 flex items-center gap-3">
                  <DrawerClose
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                      setVideos([]);
                      setHasMore(false);
                      setTotalData(0);
                    }}
                  >
                    <ChevronLeft size={18} />
                  </DrawerClose>
                  <div className="border border-gray-700 w-full rounded-full shadow-md flex items-center pl-4">
                    <FaSearch />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="搜索作品"
                      className="bg-transparent placeholder:text-white rounded-full border-0 focus:border-transparent focus-visible:ring-0"
                      onKeyDown={(e) => e.key === "Enter" && searchHandler()}
                    />
                  </div>
                  <button onClick={searchHandler} className="w-[50px]">
                    搜索
                  </button>
                </div>
                {!videos?.length && page === 1 && isLoadingInitial ? (
                  <div className="w-full flex justify-center items-center mt-[100px]">
                    <img src={loader} className="w-14" alt="" />
                  </div>
                ) : (
                  <div className="py-5">
                    <div className="grid grid-cols-3 gap-1">
                      {videos.map((item: any) => (
                        <div
                          key={item.post_id}
                          onClick={() => {
                            setSelectedMovieId(item?.post_id);
                            setShowVideoFeed(true);
                            setIsDrawerOpen(false);
                          }}
                        >
                          <VideoCard videoData={item} />
                        </div>
                      ))}
                    </div>
                    <InfiniteLoad2
                      data={videos}
                      fetchData={fetchMoreData}
                      hasMore={hasMore}
                      scrollableTarget="scrollableSearchDiv"
                    />
                  </div>
                )}
              </div>
            </>
          </DrawerContent>
        )}
      </Drawer>
    </div>
  );
};

export default SearchVideo;
