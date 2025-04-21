import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/create-center/drawer";
import Divider from "./divider";
import { useEffect, useState } from "react";
import AsyncDecryptedImage from "@/utils/asyncDecryptedImage";
import { Camera } from "lucide-react";
import {
  useProfileUploadMutation,
  useRemoveAvatarMutation,
  useSettingUploadMutation,
} from "@/store/api/profileApi";
import TranLoader from "../shared/tran-loader";
import ImageUpload from "../profile/image-upload";

const ProfilePhotoUpload = ({
  imgurl,
  srcImg,
  setShowAvatar,
  reviewStatus,
  refetchHandler,
  exist,
  refetch
}: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [removeAvatar, { isLoading, data }] = useRemoveAvatarMutation();
  const [settingUpload, { data: settingUploadData, isLoading: loading1 }] =
    useSettingUploadMutation();

  const [profileUpload, { data: profileUploadData, isLoading: loading2 }] =
    useProfileUploadMutation();

  const removeHandler = async () => {
    setIsOpen(false);
    await removeAvatar("");
    refetchHandler();
  };

  useEffect(() => {
    refetchHandler();
  }, [isOpen]);

  console.log(srcImg, "srcImg");

  return (
    <>
      {isLoading || loading1 || loading2 ? <TranLoader /> : <></>}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <div>
            {imgurl && exist ? (
              <div className="flex justify-center items-center relative">
                <AsyncDecryptedImage
                  // imageUrl={imgurl || "/placeholder.svg"}
                  imageUrl={srcImg ? srcImg : imgurl}
                  alt="Preview"
                  className="w-[80px] h-[80px] rounded-full bg-[#FFFFFF12] flex justify-center items-center object-cover object-center filter saturate-50 brightness-75"
                />
                <div className="absolute">
                  <Camera />
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center relative">
                <div className="w-[80px] h-[80px] rounded-full bg-[#FFFFFF12] flex justify-center items-center object-cover object-center filter saturate-50 brightness-75"></div>
                <div className="absolute">
                  <Camera />
                </div>
              </div>
            )}
          </div>
        </DrawerTrigger>
        <DrawerContent className="border-0">
          <div className="p-5">
            <h1 className="text-[16px] text-white text-center">头像</h1>
            <div className="space-y-5 mt-5">
            {/* <ImageUpload
                imgurl=""
                reviewStatus={reviewStatus}
                setIsOpen={setIsOpen}
                refetchHandler={refetchHandler}
                settingUpload={settingUpload}
                settingUploadData={settingUploadData}
                profileUpload={profileUpload}
                refetch={refetch}
              />
              <Divider show={true} /> */}
              <div
                className=""
                onClick={() => {
                  setIsOpen(false);
                  setShowAvatar(true);
                }}
              >
                <h1 className="text-[16px] text-white">获取头像</h1>
                <p className="text-[12px] text-[#888888]">
                  升级即可解锁专属头像！
                </p>
              </div>
              <Divider show={true} />
              <div onClick={removeHandler}>
                <h1 className="text-[16px] text-[#F54C4F]">移除头像</h1>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default ProfilePhotoUpload;
