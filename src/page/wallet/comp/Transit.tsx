import React, { useEffect, useState } from "react";
import "../wallet.css";
import { ChevronRight, ScrollText } from "lucide-react";
import transit from "../../../assets/wallet/transit.png";
import empty from "./empty.svg";
import {
  useGetInviteQuery,
  useGetTransitionHistoryQuery,
} from "@/store/api/wallet/walletApi";
import noTran from "../../../assets/wallet/noTran.svg";
import { useNavigate } from "react-router-dom";
import loader from "../../home/vod_loader.gif";

interface TransitProps {}

const Transit: React.FC<TransitProps> = ({}) => {
  const navigate = useNavigate();
  const [tran, setTran] = useState<any[]>([]);
  const { data, isLoading } = useGetTransitionHistoryQuery({
    period: "",
    type: "",
  });
  const [status, setStatus] = useState([]);
  const { data: config } = useGetInviteQuery("");
  useEffect(() => {
    if (data?.data) {
      setTran(data?.data);
    }
    if (config?.data) {
      setStatus(config?.data?.transaction_status_list);
    }
  }, [data, config]);

  // console.log(status)
  // const getStatusClass = (status: string) => {
  //   switch (status.toLowerCase()) {
  //     case "approved":
  //       return {
  //         container: "success_state",
  //         text: "success_text",
  //       };
  //     case "pending":
  //       return {
  //         container: "pending_state",
  //         text: "pending_text",
  //       };
  //     case "rejected":
  //       return {
  //         container: "failed_state",
  //         text: "failed_text",
  //       };
  //     default:
  //       return {
  //         container: "default_state",
  //         text: "default_text",
  //       };
  //   }
  // };
  const getStatusClass = (keyword: string) => {
    const statusObj: any = status.find(
      (s: any) => s.keyword.toLowerCase() === keyword.toLowerCase()
    );
    return {
      backgroundColor: statusObj?.bg_color_code || "#777", // Default grey if not found
      color: statusObj?.text_color_code || "#FFF", // Default white if not found
    };
  };
  return (
    <div className=" py-[20px]">
      {/* header */}
      <div className="transit_header px-[20px] py-[10px] flex items-center justify-between">
        <h1 className=" text-white text-[16px] font-[500] leading-normal">
          明细
        </h1>
        <div
          onClick={() => navigate("/wallet/transition")}
          className="  flex transit_view_all pl-[10px] py-[4px] pr-[2px]"
        >
          <span className=" capitalize">查看全部</span>
          <ChevronRight />
        </div>
      </div>
      <div className=" py-[12px] px-[16px]">
        {isLoading ? (
          <div className=" flex justify-center items-center py-[100px]">
            <div className="heart">
              <img src={loader} className="w-[100px] h-[100px]" alt="Loading" />
            </div>
          </div>
        ) : (
          <>
            {data?.data.length === 0 || tran.length === 0 ? (
              <div className=" flex flex-col justify-center items-center h-[400px] gap-[16px]">
                <img src={empty} alt="" />
                <h1 className=" text-[#888] font-[400] text-[14px]">
                  您还没有任何过渡记录
                </h1>
              </div>
            ) : (
              <>
                {tran?.slice(0, 5).map((ts: any) => (
                  // {tran?.map((ts: any) => (
                  <div
                    key={ts.id}
                    className=" transit_list py-[20px] flex justify-between"
                  >
                    <div className=" flex gap-[12px] items-center">
                      <div className="bitcoin_border w-[56px] h-[56px] flex justify-center items-center">
                        <img
                          className=" w-[26px] h-[26px]"
                          src={transit}
                          alt=""
                        />
                      </div>
                      <div className=" flex flex-col gap-[4px]">
                        <span className=" text-white text-[14px] font-[500] leading-[20px]">
                          {ts.description}
                        </span>
                        <span className=" text-[#777] text-[12px] font-[400] leading-[20px]">
                          {ts.date}
                        </span>
                      </div>
                    </div>
                    <div className=" flex flex-col justify-center items-center gap-[6px]">
                      <span>
                        {ts.dr_cr === "cr" ? "+" : "-"} {ts.amount}
                      </span>
                      {ts.status && (
                        <div
                          style={{
                            backgroundColor: getStatusClass(ts.status)
                              .backgroundColor,
                            color: getStatusClass(ts.status).color,
                          }}
                          className="px-[12px] py-[6px] flex justify-center items-center rounded-[6px]  text-[12px] font-[400] leading-[15px]"
                        >
                          {/* <span className={getStatusClass(ts.status).text}> */}
                          {/* {ts.status} */}
                          {ts.status === "approved" && "已批准"}
                          {ts.status === "pending" && "待处理"}
                          {ts.status === "rejected" && "已拒绝"}
                          {ts.status === "success" && "成功"}
                          {ts.status === "failed" && "失败"}
                          {ts.status === "default" && "默认"}
                          {/* </span> */}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Transit;
