import { cvToHex, hexToCV, uintCV } from "@stacks/transactions";
import path from "path";
import fs from "fs";
import { setTimeout } from "timers/promises";

(async () => {
  let blockHeight = 10;
  fs.writeFileSync(path.resolve("results.csv"), "height,rnd\n");
  while (blockHeight < 167529) {
    const body = JSON.stringify({
      sender: "SP187Y7NRSG3T9Z9WTSWNEN3XRV1YSJWS81C7JKV7",
      arguments: [cvToHex(uintCV(blockHeight))],
    });

    const response = await fetch(
      "https://api.hiro.so/v2/contracts/call-read/SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11/citycoin-vrf-v2/get-rnd",
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.HIRO_API_KEY,
        },
        method: "POST",
        body,
      }
    );

    const responseBody = await response.json();
    const result = hexToCV(responseBody.result).value.value;
    process.stdout.write(`Block ${blockHeight}: ${result}\n`);
    fs.appendFileSync(
      path.resolve("results.csv"),
      `${blockHeight},${result}\n`
    );
    blockHeight = blockHeight + 1;
    await setTimeout(100);
  }
})();
