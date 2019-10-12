let splittedMsg = "";
let totalLength = 0;

module.exports = {
    initSplittedMsg : function(msg, msgTotalLength) {
        // console.debug("Init splitted msg")
        splittedMsg = msg;
        totalLength = msgTotalLength;
    },
    getInitMsg : function(){
        return splittedMsg;
    },
    getTotalLength : function(){
        return totalLength;
    },
    tryAppendMsg : function(msg){
        // console.debug("Trying to append msg");
        // console.debug(`length after concat: ${Buffer.byteLength(splittedMsg.concat(msg), "hex")} vs totalLength expected: ${totalLength}`);
        splittedMsg = splittedMsg.concat(msg);
        return splittedMsg;
    },
    isSplittedMsgWaiting : function(){
        // console.debug(`is msg split ? ${splittedMsg !== ""}`)
        return splittedMsg !== "";
    },
    resetSplittedMsg : function(){
        // console.debug("Reset splitted msg")
        splittedMsg = "";
        totalLength = 0;
    }
}