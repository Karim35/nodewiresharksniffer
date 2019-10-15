const { spawn } = require("child_process");
const axios = require("axios");
const payloadReader = require("./payloadReader");
const msgIds = require("./neededMsg").msgIds;
const treasureHelper = require("./treasureHelper");
const splittedMsgBuilder = require("./splittedMsgBuilder");
const JSONStream = require("JSONStream");
/**
 * on Linux, Unix, *BSD you can use

tshark -ni any

on Windows, any does not work, so you'll have to specify the interface ID or number

tshark -ni 1 -ni 2 -ni 3 (this will work on Linux, Unix, *BSD as well)

You can get the interface number with

dumpcap -D -M
 */
const tsharkParams = [
  "-l",
  "-Y",
  "tcp.len > 0",
  "-T",
  "json",
  "-ni",
  "2", //TODO interface to choose it or determine it programmaticaly
  "-e",
  "tcp.srcport",
  "-e",
  "tcp.payload",
  "-o", //https://www.wireshark.org/docs/dfref/t/tcp.html see not captured flag tcp.analysis.lost_segment
  "tcp.desegment_tcp_streams:true", //promiscuous mode might help
  "port",
  "5555",
];
let tsharkProcess;
let tsharkBinName = "tshark";
if (process.platform === "win32") {
  tsharkBinName = "tshark.exe";
}

let stream = JSONStream.parse('._source.*');
tsharkProcess = spawn("tshark", tsharkParams);

tsharkProcess.on("error", err => {
  console.error("error while starting tshark", err);
});

const MSGID_DATALEN_SIZE = 2;


tsharkProcess.stdout.pipe(stream);

stream.on('data', async data => {
  let srcport = data["tcp.srcport"];
  let payload = data["tcp.payload"];
  if (payload) {
    let dataPayload = payload[0];
    if (splittedMsgBuilder.isSplittedMsgWaiting()) {
      dataPayload = splittedMsgBuilder.tryAppendMsg(dataPayload);
      if (Buffer.byteLength(dataPayload, "hex") >= splittedMsgBuilder.getTotalLength()) {
        splittedMsgBuilder.resetSplittedMsg();
      }
      if (splittedMsgBuilder.isSplittedMsgWaiting()) return;
    } else {
      handleSplitMsg(dataPayload);
      if (splittedMsgBuilder.isSplittedMsgWaiting()) return;
    }
    let msgId = payloadReader.readMsgId(dataPayload);
    if (!msgIds.includes(msgId)) return;
    let context = getContext(srcport);
    let decodedMessage = await decodePayload(dataPayload, context);
    if(msgId != 226) console.log(decodedMessage);
    treasureHelper.handleData(decodedMessage);
  }
});

tsharkProcess.stderr.pipe(process.stdout);

tsharkProcess.on("close", code => {
  console.log(`child process exited with code ${code}`);
});

function handleSplitMsg(dataPayload) {
  const dataLenLen = payloadReader.getDataLenLen(
    payloadReader.getHeaderFromPayload(dataPayload)
  );
  const HEADER_SIZE = MSGID_DATALEN_SIZE + dataLenLen;
  let dataLen = payloadReader.readDataLen(dataPayload);
  let dataPayloadLen = Buffer.byteLength(dataPayload, "hex") - HEADER_SIZE;
  if (!dataLen || dataLen == 0 || dataPayloadLen >= dataLen) return; //msg isn't split
  //msg is splitted
  splittedMsgBuilder.initSplittedMsg(dataPayload, dataLen + HEADER_SIZE);
}

async function decodePayload(payload, context) {
  let response;
  try {
    response = await axios.post(
      "http://vps408293.ovh.net:5000/decoder/".concat(context),
      payload
    );
  } catch (err) {
    console.log(`error ${payload}`);
  }
  if (response) {
    return response.data;
  }
  return "";
}

function getContext(srcport) {
  let context = "fromclient";
  if (srcport == 5555) {
    context = "fromserver";
  }
  return context;
}
