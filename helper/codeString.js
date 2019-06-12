// --- COMPLETION CODE

exports.makeCode = function(len){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYabcdefghijklmnopqrstuvwxy0123456789";
    for( var i=0; i < len; i++ ){
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};
