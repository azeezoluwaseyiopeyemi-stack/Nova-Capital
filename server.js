window.onerror = function(message, source, lineno, colno, error) {
    let screenError = document.createElement('div');
    screenError.style.cssText = 'position:fixed; top:0; left:0; width:100%; background:red; color:white; padding:20px; z-index:99999; font-family:monospace; font-size:18px;';
    screenError.innerHTML = `<strong>CRITICAL ERROR:</strong> ${message} <br><small>Line: ${lineno} | File: ${source}</small>`;
    document.body.prepend(screenError);
};
