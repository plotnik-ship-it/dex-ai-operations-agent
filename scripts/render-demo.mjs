import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
const recording=JSON.parse(await readFile('docs/demo/recording.json','utf8'));
const windowsTools=join(process.env.LOCALAPPDATA||'','Microsoft','WinGet','Links');
const ffmpeg=process.env.FFMPEG_PATH||(process.platform==='win32'&&existsSync(join(windowsTools,'ffmpeg.exe'))?join(windowsTools,'ffmpeg.exe'):'ffmpeg');
const ffprobe=process.env.FFPROBE_PATH||(process.platform==='win32'&&existsSync(join(windowsTools,'ffprobe.exe'))?join(windowsTools,'ffprobe.exe'):'ffprobe');
function run(command,args){const result=spawnSync(command,args,{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});if(result.status!==0)throw Error(result.error?.message||result.stderr);return result.stdout;}
const source=JSON.parse(run(ffprobe,['-v','error','-show_entries','format=duration','-of','json','docs/demo/raw.webm']));
const sourceDuration=Number(source.format.duration),duration=110,ratio=duration/sourceDuration;
const captions={
 problem:'Dex AI Operations Agent: an independent travel-operations demo.\\NAll bookings and contracts are fictional.',
 request:'Qwen3 4B proposes tools locally. The server validates every call.\\NThe model cannot execute SQL, grant access, approve or send.',
 evidence:'USD 1,500 outstanding; passport copy missing.\\NPayment and document deadlines are grounded in cited contract excerpts.',
 tools:'Three validated tools: booking lookup, contract retrieval, reminder draft.\\NThe run records latency, model calls and token usage.',
 approval:'A human reviews the exact message, evidence and test recipient.\\NApproval binds its payload hash; the worker rechecks current data and access.',
 inbox:'The approved action reaches Mailpit, the local test inbox.\\NNo production traveler receives this message.',
 trace:'Inspect the same trace ID from request through approved delivery.\\NThis companion viewer renders the actual authorized API snapshot.',
 events:'The full stream retains decisions, arguments, permission checks and results.\\NErrors and attempts are recorded; SMTP uncertainty is never blindly retried.',
 reliability:'98 passing test cases include 60 system evaluation scenarios.\\N8/8 live Qwen cases and 4/4 adversarial cases are reported separately.'
};
function time(seconds){const cs=Math.round(seconds*100);return Math.floor(cs/360000)+':'+String(Math.floor(cs/6000)%60).padStart(2,'0')+':'+String(Math.floor(cs/100)%60).padStart(2,'0')+'.'+String(cs%100).padStart(2,'0');}
const ass=['[Script Info]','ScriptType: v4.00+','PlayResX: 1280','PlayResY: 960','WrapStyle: 0','[V4+ Styles]','Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding','Style: Default,Arial,26,&H00FFFFFF,&H00FFFFFF,&H00243D30,&H00243D30,0,0,0,0,100,100,0,0,1,0,0,2,35,35,36,1','[Events]','Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
 ...recording.marks.map((mark,i)=>'Dialogue: 0,'+time(mark.seconds*ratio)+','+time(i+1<recording.marks.length?recording.marks[i+1].seconds*ratio:duration)+',Default,,0,0,0,,'+captions[mark.scene])
].join('\n');
await writeFile('docs/demo/captions.ass',ass+'\n');
run(ffmpeg,['-y','-i','docs/demo/raw.webm','-vf','setpts='+ratio+'*PTS,fps=30,pad=1280:960:0:0:color=0x193d32,subtitles=docs/demo/captions.ass','-t','110','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','docs/demo/dex-demo.mp4']);
run(ffmpeg,['-y','-ss',String(recording.marks.find(m=>m.scene==='evidence').seconds*ratio+5),'-i','docs/demo/dex-demo.mp4','-frames:v','1','docs/demo/poster.jpg']);
const output=JSON.parse(run(ffprobe,['-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,avg_frame_rate','-of','json','docs/demo/dex-demo.mp4']));
if(Number(output.format.duration)<90||Number(output.format.duration)>120)throw Error('Final video must be 90–120 seconds');
const metadata={...recording,renderedAt:new Date().toISOString(),sourceDurationSeconds:sourceDuration,outputDurationSeconds:Number(output.format.duration),playbackScale:ratio,captionLanguage:'English',voiceover:false,output:'docs/demo/dex-demo.mp4',ffprobe:output,editing:'Continuous browser capture normalized to 110 seconds. Burned-in English captions; original event durations remain visible and unchanged.'};
await writeFile('docs/demo/video-metadata.json',JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({output:metadata.output,durationSeconds:metadata.outputDurationSeconds,sizeBytes:output.format.size,traceId:metadata.traceId,model:metadata.model,deliveryStatus:metadata.deliveryStatus},null,2));
