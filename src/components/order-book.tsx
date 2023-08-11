import example from "../utils/example.json";
import { useState, useEffect } from "react";
import _ from "lodash";

type QuoteType = "bid" | "ask";
type QuoteStatus = "new" | "sizeGain" | "sizeLoss" | "normal";
type LastPriceStatus = "gain" | "loss" | "same";

export default function OrderBook() {
  const [askPrice, setAskPrice] = useState<number[]>([]);
  const [askSize, setAskSize] = useState<number[]>([]);
  const [askTotals, setAskTotals] = useState<number[]>([]);
  const [askStatus, setAskStatus] = useState<QuoteStatus[]>(
    Array(8).fill("normal")
  );

  const [bidPrice, setBidPrice] = useState<number[]>([]);
  const [bidSize, setBidSize] = useState<number[]>([]);
  const [bidTotals, setBidTotals] = useState<number[]>([]);
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
      const rawAsks = raw?.data?.asks;
      const rawBids = raw?.data?.bids;

      updateQuotes(
        "ask",
        rawAsks,
        askPrice,
        askSize,
        askStatus,
        raw?.data?.type
      );
      updateQuotes(
        "bid",
        rawBids,
        bidPrice,
        bidSize,
        bidStatus,
        raw?.data?.type
      );
    }
  };

  const updateQuotes = (
    quoteType: QuoteType,
    quotes: string[],
    price: number[],
    size: number[],
    quoteStatus: QuoteStatus[],
    dataType: string
  ) => {
    if (dataType === "snapshot") {
      // console.log("resetting with quotes: ", quotes.slice(0, 8));
      const [snapshotPrice, snapshotSize] = getSnapshotQuotes(quotes);
      updatePriceAndSize(quoteType, snapshotPrice, snapshotSize);

      quoteType === "bid"
        ? setBidStatus(Array(8).fill("normal"))
        : setAskStatus(Array(8).fill("normal"));
    } else if (quotes?.[0] && price?.[0] && dataType === "delta") {
      for (let i = 0; i < quotes.length; i++) {
        let tempPrice = price;
        let tempSize = size;
        const newPrice = Number(quotes[i][0]);
        const newSize = Number(quotes[i][1]);

        // append highest price to start
        if (newSize !== 0 && Number(newPrice) > price[0]) {
          console.log("highest price insert quote: ", quotes[i]);
          tempPrice.unshift(Number(newPrice));
          tempPrice.pop();
          tempSize.unshift(Number(newSize));
          tempSize.pop();

          updateStatus(quoteType, quoteStatus, 0, "new");
        } else if (
          newSize !== 0 &&
          Number(newPrice) <= price[0] &&
          Number(newPrice) >= price[7]
        ) {
          if (
            price.includes(Number(newPrice)) &&
            !size.includes(Number(newSize))
          ) {
            // replace old quote
            console.log("update old quote: ", quotes[i]);
            const updateIndex = tempPrice.indexOf(Number(newPrice));
            const status =
              newSize > tempSize[updateIndex] ? "sizeGain" : "sizeLoss";
            updateStatus(quoteType, quoteStatus, updateIndex, status);

            tempPrice.splice(updateIndex, 1, Number(newPrice));
            tempSize.splice(updateIndex, 1, Number(newSize));
          } else if (!price.includes(Number(newPrice))) {
            // insert new bid
            console.log("insert new quote: ", quotes[i]);
            let index = _.sortedIndex(tempPrice.reverse(), Number(newPrice));

            tempPrice.splice(index, 0, Number(newPrice));
            tempPrice.reverse().pop();
            tempSize.reverse().splice(index, 0, Number(newSize));
            tempSize.reverse().pop();

            updateStatus(quoteType, quoteStatus, index, "new");
          }
        }

        updatePriceAndSize(quoteType, tempPrice, tempSize);
      }
    }
  };

  const getSnapshotQuotes = (quotes: string[]) => {
    const snapshotPrice = quotes.slice(0, 8).map((quote) => {
      return Number(quote[0]);
    });
    const snapshotSize = quotes.slice(0, 8).map((quote) => {
      return Number(quote[1]);
    });

    return [snapshotPrice, snapshotSize];
  };

  const updatePriceAndSize = (
    quoteType: QuoteType,
    price: number[],
    size: number[]
  ) => {
    quoteType === "bid" ? setBidPrice(price) : setAskPrice(price);
    quoteType === "bid" ? updateBidSize(size) : updateAskSize(size);
  };

  const updateBidSize = (bidSize: number[]) => {
    setBidSize(bidSize);
    updateTotalSize("bid", bidSize);
  };

  const updateAskSize = (askSize: number[]) => {
    setAskSize(askSize);
    updateTotalSize("ask", askSize);
  };

  const updateStatus = (
    quoteType: QuoteType,
    quoteStatus: QuoteStatus[],
    index: number,
    status: QuoteStatus
  ) => {
    let tempStatus = quoteStatus;
    tempStatus.splice(index, 1, status);
    quoteType === "bid" ? setBidStatus(tempStatus) : setAskStatus(tempStatus);
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

  const updateTotalSize = (quoteType: QuoteType, size: number[]) => {
    const totals = [];
    let cumulativeTotal = 0;

    for (let i = size.length - 1; i >= 0; i--) {
      const index = quoteType === "ask" ? i : size.length - 1 - i;
      cumulativeTotal = cumulativeTotal + Number(size[index]);
      totals.push(cumulativeTotal);
    }

    quoteType === "ask" ? setAskTotals(totals.reverse()) : setBidTotals(totals);
  };

  const formatNumber = (number: any, digits: number) => {
    return Number(number).toLocaleString(undefined, {
      minimumFractionDigits: digits,
    });
  };

  const getSizePercent = (
    quoteType: QuoteType,
    currentSize: number,
    totals: number[]
  ) => {
    const grandTotalIndex = quoteType === "ask" ? 0 : 7;
    return ((currentSize / totals[grandTotalIndex]) * 100).toString() + "%";
  };

  return (
    <div className="bg-background-main w-[300px]">
      <div className="my-2 border-b-2 border-header-stroke">
        <p className="px-2 pb-2 text-text-default font-medium">Order Book</p>
      </div>
      <div className="m-2 flex flex-row justify-between">
        <div className="flex w-[55%] justify-between">
          <p className="text-text-head">Price (USD)</p>
          <p className="text-text-head">Size</p>
        </div>
        <p className="text-text-head">Total</p>
      </div>
      <div className="pb-2">
        {askPrice &&
          askSize &&
          askPrice.map((ask: number, index: number) => {
            return (
              <div
                key={ask}
                className={`px-2 py-[0.75px] flex justify-between hover:bg-background-hover
                ${askStatus[index] === "new" && "animate-flash-red"}`}
              >
                <div className="flex w-1/2">
                  <div className="w-1/2 text-text-sell">
                    {formatNumber(askPrice[index], 1)}
                  </div>
                  <div
                    className={`w-1/2 text-right
                    ${askStatus[index] === "sizeGain" && "animate-flash-green"}
                    ${askStatus[index] === "sizeLoss" && "animate-flash-red"}`}
                  >
                    {formatNumber(askSize[index], 0)}
                  </div>
                </div>
                <div className="w-[45%] relative">
                  <div className="z-10 absolute right-0">
                    {formatNumber(askTotals[index], 0)}
                  </div>
                  <div
                    style={{
                      width: getSizePercent("ask", askTotals[index], askTotals),
                    }}
                    className="h-full bg-background-sell-total absolute right-0"
                  />
                </div>
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
      <div className="py-2">
        {bidPrice &&
          bidSize &&
          bidPrice.map((bid: number, index: number) => {
            return (
              <div
                key={bid}
                className={`px-2 py-[0.75px] flex justify-between hover:bg-background-hover
                ${bidStatus[index] === "new" && "animate-flash-green"}`}
              >
                <div className="flex w-1/2">
                  <div className="w-1/2 text-text-buy">
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
                <div className="w-[45%] relative">
                  <div className="z-10 absolute right-0">
                    {formatNumber(bidTotals[index], 0)}
                  </div>
                  <div
                    style={{
                      width: getSizePercent("bid", bidTotals[index], bidTotals),
                    }}
                    className="h-full bg-background-buy-total absolute right-0"
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
