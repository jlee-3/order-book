import example from "../utils/example.json";
import { useState, useEffect } from "react";
import _ from "lodash";

type QuoteStatus = "new" | "sizeGain" | "sizeLoss" | "normal";
type LastPriceStatus = "gain" | "loss" | "same";

export default function OrderBook() {
  const [bidPrice, setBidPrice] = useState<number[]>([]);
  const [bidSize, setBidSize] = useState<number[]>([]);
  const [bidTotals, setBidTotals] = useState<any>([]);
  const [bidStatus, setBidStatus] = useState<QuoteStatus[]>(
    Array(8).fill("normal")
  );
  const [lastPrice, setLastPrice] = useState<number>();
  const [lastPriceStatus, setLastPriceStatus] = useState<LastPriceStatus>();

  const response = example;
  const data = response?.data;
  const rawBids = data.bids.slice(0, 8); // sell

  const orderbookSocket = new WebSocket("wss://ws.btse.com/ws/oss/futures");
  const lastPriceSocket = new WebSocket("wss://ws.btse.com/ws/futures");

  const subscribeOrderbook = () => {
    if (orderbookSocket.readyState === orderbookSocket.OPEN) {
      const payload = {
        op: "subscribe",
        args: [`update:BTCPFC_0`],
      };
      console.log("subscribing to orderbook api: " + JSON.stringify(payload));
      orderbookSocket.send(JSON.stringify(payload));
    }
  };

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

  const unsubscribe = () => {
    if (orderbookSocket.readyState === orderbookSocket.OPEN) {
      const payload = {
        op: "unsubscribe",
        args: [`update:BTCPFC_0`],
      };
      console.log(
        "un-subscribing to oss delta for incremental update: " +
          JSON.stringify(payload)
      );
      orderbookSocket.send(JSON.stringify(payload));
    }
  };

  orderbookSocket.onopen = () => {
    subscribeOrderbook();
  };

  lastPriceSocket.onopen = () => {
    subscribeLastPrice();
  };

  orderbookSocket.onmessage = (e) => {
    if (typeof e.data === "string") {
      // console.log("received: '" + e.data + "'");
      const raw = JSON.parse(e.data);
      // const topic = raw && raw.topic ? raw.topic : "";
      const rawBids = raw?.data?.bids;

      updateBids(rawBids, raw?.data?.type);
    }
  };

  const updateBids = (quotes: any[], type: string) => {
    if (type === "snapshot") {
      // console.log("resetting with quotes: ", quotes.slice(0, 8));
      setBidPrice(
        quotes.slice(0, 8).map((quote) => {
          return Number(quote[0]);
        })
      );
      updateBidSize(
        quotes.slice(0, 8).map((quote) => {
          return Number(quote[1]);
        })
      );
      setBidStatus(Array(8).fill("normal"));
    } else if (quotes?.[0] && bidPrice?.[0] && type === "delta") {
      for (let i = 0; i < quotes.length; i++) {
        let tempBidPrice = bidPrice;
        let tempBidSize = bidSize;
        const newPrice = quotes[i][0];
        const newSize = quotes[i][1];

        // append highest price to start
        if (newSize !== "0" && Number(newPrice) > bidPrice[0]) {
          // console.log("highest price insert quote: ", quotes[i]);
          tempBidPrice.unshift(Number(newPrice));
          tempBidPrice.pop();
          tempBidSize.unshift(Number(newSize));
          tempBidSize.pop();

          updateBidStatus(0, "new");
        } else if (
          quotes[i][1] !== "0" &&
          Number(newPrice) <= bidPrice[0] &&
          Number(newPrice) >= bidPrice[7]
        ) {
          // replace old bid
          if (
            bidPrice.includes(Number(newPrice)) &&
            !bidSize.includes(Number(newSize))
          ) {
            // console.log("update old quote: ", quotes[i]);
            // console.log("old tempBidSize: ", tempBidSize);
            const updateIndex = tempBidPrice.indexOf(Number(newPrice));
            const status =
              newSize > tempBidSize[updateIndex] ? "sizeGain" : "sizeLoss";
            // console.log(
            //   "updated status: ",
            //   status,
            //   " newSize: ",
            //   newSize,
            //   " oldSize: ",
            //   tempBidSize[updateIndex]
            // );
            updateBidStatus(updateIndex, status);

            tempBidPrice.splice(updateIndex, 1, Number(newPrice));
            tempBidSize.splice(updateIndex, 1, Number(newSize));
            // console.log("updateIndex: ", updateIndex);
            // console.log("updated tempBidSize: ", tempBidSize);
            // console.log("[tempBidPrice length]: ", tempBidPrice.length);

            // insert new bid
          } else if (!bidPrice.includes(Number(newPrice))) {
            // console.log("insert new quote: ", quotes[i]);
            // console.log("original tempBidPrice: ", tempBidPrice);
            // console.log("original tempBidSize: ", tempBidSize);
            let index = _.sortedIndex(tempBidPrice.reverse(), Number(newPrice));
            // console.log("index: ", index);

            tempBidPrice.splice(index, 0, Number(newPrice));
            tempBidPrice.reverse().pop();
            tempBidSize.reverse().splice(index, 0, Number(newSize));
            tempBidSize.reverse().pop();

            // console.log("updated tempBidPrice: ", tempBidPrice);
            // console.log("updated tempBidSize: ", tempBidSize);

            updateBidStatus(index, "new");
          }
        }

        setBidPrice(tempBidPrice);
        updateBidSize(tempBidSize);
      }
    }
  };

  const updateBidSize = (bidSize: number[]) => {
    setBidSize(bidSize);
    updateTotalSize();
  };

  const updateBidStatus = (index: number, status: QuoteStatus) => {
    let tempBidStatus = bidStatus;
    tempBidStatus.splice(index, 1, status);
    setBidStatus(tempBidStatus);
  };

  lastPriceSocket.onmessage = (e) => {
    if (typeof e.data === "string") {
      // console.log("received: '" + e.data + "'");
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

  const updateTotalSize = () => {
    const totals = [];
    let cumulativeTotal = 0;

    for (let i = bidSize.length - 1; i >= 0; i--) {
      cumulativeTotal = cumulativeTotal + Number(bidSize[i]);
      totals.push(cumulativeTotal);
    }

    setBidTotals(totals.reverse());
  };

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
      <div className="pb-2">
        {bidPrice &&
          bidSize &&
          bidPrice.map((bid: number, index: number) => {
            return (
              <div
                key={bid}
                className={`px-2 flex justify-between hover:bg-background-hover
                ${bidStatus[index] === "new" && "animate-flash-green"}`}
              >
                <div className="flex w-1/2">
                  <div className="w-1/2 text-text-sell">
                    {formatNumber(bidPrice[index], 1)}
                  </div>
                  <div
                    className={`w-1/2 text-right
                    ${bidStatus[index] === "sizeGain" && "animate-flash-green"}
                    ${bidStatus[index] === "sizeLoss" && "animate-flash-red"}`}
                  >
                    {formatNumber(bidSize[index], 0)}
                  </div>
                </div>
                <div className="">{formatNumber(bidTotals[index], 0)}</div>
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
    </div>
  );
}
