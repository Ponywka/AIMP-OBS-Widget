const elements = {
	widget: document.querySelector(".widget"),
	cover: document.querySelector(".songcover"),
	title: document.querySelector(".songtitle"),
	artist: document.querySelector(".songartist"),
	time: document.querySelector(".songtime")
};

const config = {
	updateTimeout: 500,
    aimpData: {
        address: 'localhost',
        port: 3333
    },
	placeholderData: {
	    title: "Loading",
		artist: "AIMP Widget by Ponywka",
		cover: 'image.png',
	}
};

function updateWidget(data){
	if(data.title) elements.title.innerText = data.title;
	if(data.artist) elements.artist.innerText = data.artist;
	if(data.cover) elements.cover.src = data.cover;
	if(data.time) elements.time.innerText = data.time;
	if(typeof data.is_playing == 'boolean'){
		if(data.is_playing){
			elements.widget.classList.remove('widget-hide');
		} else {
			elements.widget.classList.add('widget-hide');
		}
	}
}

updateWidget(Object.assign(config.placeholderData, {is_playing: false}));

function secondsToTime(sec) {
  sec = Math.floor(sec);
  let seconds = sec % 60;
  let minutes = Math.floor(sec / 60) % 60;
  let hours = Math.floor(sec / 3600);

  minutes = minutes.toString().padStart(2, "0");
  seconds = seconds.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

function netRequest(params) {
    return new Promise((resolve, reject) => {
        let postData = JSON.stringify(params.data || {});
		
        let headers = params.headers || {};
        headers['Content-Type'] = 'application/json';

        let xhr = new XMLHttpRequest();
        xhr.open(params.method || 'GET', `http://${params.hostname || 'localhost'}:${params.port || 3333}${params.path || '/'}`);
		for(let headername of Object.keys(headers)) xhr.setRequestHeader(headername, headers[headername]);
        xhr.send(postData);

        xhr.onload = function() {
            resolve(xhr.responseText);
        };
        xhr.onerror = function() {
            reject();
        };
    });
}

function aimpRequest(method, params = {}){
	return netRequest({
        hostname: config.aimpData.address,
        port: config.aimpData.port,
        path: '/RPC_JSON',
        method: 'POST',
        data: {
            "method": method,
            "params": params,
            "jsonrpc": 2.0
        }
    });
}

let musicPlayingNow = {};
let workRightNow = false;
let worker = setInterval(async function() {
    if (workRightNow) return;
    workRightNow = true;
    work: try {
        let playerControlPanelState = await aimpRequest("GetPlayerControlPanelState");
		
        if (playerControlPanelState == "") {
			// No info received, hiding widget
			updateWidget({is_playing: false});
			break work;
		}
		
        playerControlPanelState = JSON.parse(playerControlPanelState);
		
        if (playerControlPanelState.error) {
			// Error in responce, hiding widget
			updateWidget({is_playing: false});
			break work;
		}
		
		// Update time + Hide/Show widget when music paused/playing
		updateWidget({
			time: `${secondsToTime(playerControlPanelState.result.track_position)} / ${secondsToTime(playerControlPanelState.result.track_length)}`,
			is_playing: playerControlPanelState.result.playback_state == 'playing'
		});
		
        if (musicPlayingNow.id == playerControlPanelState.result.track_id) {
			// Do not receive information about song (Information is already there)
			break work;
		}
		
		let playlistEntryInfo = JSON.parse(await aimpRequest("GetPlaylistEntryInfo", {"track_id": playerControlPanelState.result.track_id}));

		if (playlistEntryInfo.error) {
			// Error in responce
			break work;
		}
		
		musicPlayingNow = playlistEntryInfo.result;
		
		let musicCover = JSON.parse(await aimpRequest("GetCover", {"track_id": musicPlayingNow.id}));
		if (!musicCover.error) {
			musicPlayingNow.cover = `http://${config.aimpData.address}:${config.aimpData.port}/${musicCover.result.album_cover_uri}`
		} else {
			musicPlayingNow.cover = config.placeholderData.cover;
		}
		
		if(!musicPlayingNow.title) musicPlayingNow.title = "Untitled";
		if(!musicPlayingNow.artist) musicPlayingNow.artist = "Unknown artist";

		updateWidget({
			title: musicPlayingNow.title,
			artist: (musicPlayingNow.album) ? `${musicPlayingNow.artist} - ${musicPlayingNow.album}` : musicPlayingNow.artist,
			cover: musicPlayingNow.cover
		});
    } catch (e) {
		updateWidget({is_playing: false});
    }
    workRightNow = false;
}, config.updateTimeout);