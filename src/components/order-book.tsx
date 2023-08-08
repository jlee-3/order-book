import example from "../utils/example.json";
import { useState, useEffect } from "react";

type LastPriceStatus = "gain" | "loss" | "same";

export default function OrderBook() {
  // const [bids, setBids] = useState<any[]>([]);
  const [lastPrice, setLastPrice] = useState<number>();
  const [lastPriceStatus, setLastPriceStatus] = useState<LastPriceStatus>();

  const response = example;
  const data = response?.data;
  const rawBids = data.bids.slice(0, 8); // sell

  const lastPriceSocket = new WebSocket("wss://ws.btse.com/ws/futures");

  const subscribeLastPrice = () => {
    if (lastPriceSocket.readyState === lastPriceSocket.OPEN) {
      const payload = {
        op: "subscribe",
        args: [`tradeHistoryApi:BTCPFC`],
      };
      console.log("subscribing to last price api: " + JSON.stringify(payload));
      lastPriceSocket.send(JSON.stringify(payload));
    }
  };

  lastPriceSocket.onopen = () => {
    subscribeLastPrice();
  };

  lastPriceSocket.onmessage = (e) => {
    if (typeof e.data === "string") {
      const raw = JSON.parse(e.data);
      if (raw?.data?.[0]?.price) {
        if (!lastPrice) {
          setLastPriceStatus("same");
        } else if (Number(raw.data[0].price) > lastPrice) {
          setLastPriceStatus("gain");
        } else if (Number(raw.data[0].price) < lastPrice) {
          setLastPriceStatus("loss");
        } else {
          setLastPriceStatus("same");
        }

        setLastPrice(Number(raw.data[0].price));
      }
    }
  };

  // useEffect(() => {
  //   setBids([...bids, response.data.bids.slice(0, 7)]);
  // }, [response, bids]);

  const appendTotals = (data: any) => {
    let cumulativeTotal = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      cumulativeTotal = cumulativeTotal + Number(data[i][1]);
      data[i] = [...data[i], cumulativeTotal];
    }
  };

  appendTotals(rawBids);

  const formatNumber = (number: any, digits: number) => {
    return Number(number).toLocaleString(undefined, {
      minimumFractionDigits: digits,
    });
  };

  return (
    <div className="bg-background-main w-[300px]">
      <div className="my-2 border-b-[0.5px] border-text-head">
        <p className="px-2 text-text-default font-medium">Order Book</p>
      </div>
      <div className="m-2 flex flex-row justify-between">
        <div className="flex w-[55%] justify-between">
          <p className="text-text-head">Price (USD)</p>
          <p className="text-text-head">Size</p>
        </div>
        <p className="text-text-head">Total</p>
      </div>
      <div>
        {rawBids.map((bid) => {
          return (
            <div key={bid[0]} className="px-2 flex justify-between">
              <div className="flex w-[50%] justify-between">
                <div className="text-text-sell">{formatNumber(bid[0], 1)}</div>
                <div>{formatNumber(bid[1], 0)}</div>
              </div>
              <div className="">{formatNumber(bid[2], 0)}</div>
            </div>
          );
        })}
      </div>
      <div
        className={`py-2 flex justify-center font-semibold items-center ${
          lastPriceStatus === "same" &&
          "bg-background-no-change text-text-default"
        }
        ${lastPriceStatus === "gain" && "bg-background-buy-total text-text-buy"}
        ${
          lastPriceStatus === "loss" &&
          "bg-background-sell-total text-text-sell"
        }
        `}
      >
        {formatNumber(lastPrice, 1)}
        {lastPriceStatus !== "same" && (
          <svg
            className={`
          ${
            lastPriceStatus === "gain" &&
            "stroke-text-buy origin-center rotate-180"
          }
          ${lastPriceStatus === "loss" && "stroke-text-sell"}
          `}
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            role="presentation"
            fill="none"
            fillRule="nonzero"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
        )}
      </div>
      <div>Status: {lastPriceStatus}</div>
    </div>
  );
}
