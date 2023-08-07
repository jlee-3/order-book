import example from "../utils/example.json";
import { useState, useEffect } from "react";

export default function OrderBook() {
  // const [bids, setBids] = useState<any[]>([]);

  const response = example;
  const data = response?.data;
  const rawBids = data.bids.slice(0, 8); // sell

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
    </div>
  );
}
