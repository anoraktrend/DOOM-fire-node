// TEST YOUR (TTY) MIGHT: DOOM FIRE! 
// (c) 2022 const void*

import { stdout } from 'process';

//
// copy+paste code as it helps.
//
// monolithic file by design - no dependencies.
//

// For zig version, see:
// https://github.com/const-void/DOOM-fire-zig/

// TRM  //////////////////////////
// Terminal size
let sz=stdout.getWindowSize ? stdout.getWindowSize() : [stdout.columns || 80, stdout.rows || 24];
let term_col=sz[0];
let term_row=sz[1];

// TTY ///////////////////////////
//escape sequence
const esc='\u001b';

//xterm-256 color cache: foreground (fg) / background (bg)
const MAX_COLOR=255;
let fg=new Array(MAX_COLOR + 1);
let bg=new Array(MAX_COLOR + 1);
for (let c=0; c<=MAX_COLOR; c++) {
  fg[c]=`${esc}[38;5;${c}m`;
  bg[c]=`${esc}[48;5;${c}m`;
}

//cursor codes
let cursor_show=`${esc}[?25h`;  //h=high
let cursor_hide=`${esc}[?25l`;  //l=low
let cursor_home=`${esc}[1;1H`;  //1,1

let screen_buf_on=`${esc}[1049h`;  //h=high
let screen_buf_off=`${esc}[1049l`; //l=low

// FIRE ////////////////////////
const FIRE_H=term_row*2;
const FIRE_W=term_col;
const FIRE_SZ=FIRE_H*FIRE_W;
const FIRE_LAST_ROW=(FIRE_H-1)*FIRE_W;

let screen_buf=new Array(FIRE_SZ);
let fire_pallette=[0,233,234,52,53,88,89,94,95,96,130,131,132,133,172,214,215,220,220,221,3,226,227,230,231,7];
let fire_black=0;
let fire_white=fire_pallette.length-1;

// start w/black screen
for (let i=0; i < FIRE_SZ; i++) {
  screen_buf[i]=fire_black;
}

// last row is "white" - fire feeder
for (let i=0; i<FIRE_W; i++) {
  screen_buf[FIRE_LAST_ROW+i]=fire_white;
}

let spread_px=0;
let spread_rnd_idx=0;
let spread_dst=0;
function spreadFire(px_idx) {
  spread_px = screen_buf[px_idx];
  if (spread_px==0) {
    screen_buf[px_idx-FIRE_W]=0;
  }
  else {
    spread_rnd_idx=Math.round(Math.random() * 3.0);// & 3;
    spread_dst=px_idx-spread_rnd_idx+1;
    screen_buf[spread_dst-FIRE_W]=spread_px - (spread_rnd_idx & 1);
  }
}

//scope cache (thread unsafe)
let doFire_x=0;
let doFire_y=0;
function doFire() {
  for (doFire_x=0; doFire_x<FIRE_W; doFire_x++) {
    for (doFire_y=0; doFire_y<FIRE_H; doFire_y++) {
      spreadFire(doFire_y*FIRE_W+doFire_x);
    }
  }
}

// c/o https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
function fmtKB(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// DURATION CONFIGURATION
// Default to 10 seconds, or accept duration argument from command line
const durationArg = parseFloat(process.argv[2]);
const DURATION_SEC = !isNaN(durationArg) && durationArg > 0 ? durationArg : 10;
const DURATION_MS = DURATION_SEC * 1000;

//scope cache (thread unsafe)
let init_s=cursor_home+bg[0]+fg[0];
let frame_x=0;
let frame_y=0;
let px_hi=0;
let px_lo=0;
let px_prev_hi=0;
let px_prev_lo=0;
let s=init_s;
let s_len=s.length;
let s_sz_min=Infinity;
let s_sz_max=0;
let s_sz_total=0;
let s_frame_tic=0;

// Benchmark metrics tracking
const frame_times = [];
const frame_timestamps = [];
let time_start = 0;
let last_frame_time = 0;
let cpu_start = null;

function cleanup() {
  stdout.write(cursor_show);
  stdout.write(screen_buf_off);
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

function drawFrame() {
  doFire();
  //scope cache reset
  px_hi=0;
  px_lo=0;
  px_prev_hi=0;
  px_prev_lo=0;
  s=init_s;  

  for (frame_y=0; frame_y<FIRE_H; frame_y=frame_y+2) {
    for (frame_x=0; frame_x<FIRE_W; frame_x++) { 
        px_hi=screen_buf[frame_y*FIRE_W+frame_x];
        px_lo=screen_buf[(frame_y+1)*FIRE_W+frame_x];
        if (px_lo!=px_prev_lo) {
          s+=bg[fire_pallette[px_lo]];
        }
        if (px_hi!=px_prev_hi) {
          s+=fg[fire_pallette[px_hi]];
        }
        s+='▀';
        px_prev_hi=px_hi;
        px_prev_lo=px_lo; 
    }
  }

  stdout.write(s);

  const now = performance.now();
  s_len = s.length;
  s_frame_tic++;
  s_sz_total += s_len;
  if (s_len < s_sz_min) s_sz_min = s_len;
  if (s_len > s_sz_max) s_sz_max = s_len;

  const dt = Math.max(0.0001, now - last_frame_time);
  frame_times.push(dt);
  frame_timestamps.push(now - time_start);
  last_frame_time = now;

  const time_pass = (now - time_start) / 1000;
  const s_sz_avg = s_sz_total / s_frame_tic;
  const current_fps = (s_frame_tic / time_pass).toFixed(2);
  const remaining_s = Math.max(0, (DURATION_MS - (now - time_start)) / 1000).toFixed(1);

  // Live status update on alternate screen buffer
  stdout.write(`${esc}[0m${bg[0]}${fg[231]} [${remaining_s}s left] mem: ${fmtKB(s_sz_min)} min / ${fmtKB(s_sz_avg)} avg / ${fmtKB(s_sz_max)} max [ ${current_fps} fps ] frame: ${s_frame_tic}   `);
}

function printBenchmarkResults(stats) {
  const {
    elapsed_sec,
    elapsed_ms,
    frame_times,
    frame_timestamps,
    s_frame_tic,
    s_sz_total,
    s_sz_min,
    s_sz_max,
    cpu_used,
    DURATION_SEC,
    term_col,
    term_row,
    FIRE_W,
    FIRE_H,
    FIRE_SZ
  } = stats;

  if (s_frame_tic === 0) {
    console.log('No frames were rendered.');
    return;
  }

  // Frame times & latency calculations
  const sorted_times = [...frame_times].sort((a, b) => a - b);
  const min_dt = sorted_times[0];
  const max_dt = sorted_times[sorted_times.length - 1];
  const avg_dt = elapsed_ms / s_frame_tic;
  const p50_dt = sorted_times[Math.floor(sorted_times.length * 0.50)];
  const p95_dt = sorted_times[Math.floor(sorted_times.length * 0.95)];
  const p99_dt = sorted_times[Math.floor(sorted_times.length * 0.99)];
  const p999_dt = sorted_times[Math.floor(sorted_times.length * 0.999)];

  // Framerates (FPS)
  const avg_fps = s_frame_tic / elapsed_sec;
  const peak_instant_fps = 1000 / min_dt;
  const low_instant_fps = 1000 / max_dt;
  const low_1pct_fps = 1000 / p99_dt;
  const low_01pct_fps = 1000 / p999_dt;

  // Per-second frame buckets
  const num_full_seconds = Math.floor(elapsed_sec);
  const sec_counts = new Array(num_full_seconds).fill(0);
  for (let i = 0; i < frame_timestamps.length; i++) {
    const sec = Math.floor(frame_timestamps[i] / 1000);
    if (sec < num_full_seconds) {
      sec_counts[sec]++;
    }
  }
  const peak_sec_fps = sec_counts.length > 0 ? Math.max(...sec_counts) : avg_fps;
  const low_sec_fps = sec_counts.length > 0 ? Math.min(...sec_counts) : avg_fps;

  // Throughput and resources
  const avg_payload_bytes = s_sz_total / s_frame_tic;
  const throughput_bytes_sec = s_sz_total / elapsed_sec;
  const mem = process.memoryUsage();
  const cpu_total_ms = (cpu_used.user + cpu_used.system) / 1000;
  const cpu_pct = (cpu_total_ms / elapsed_ms) * 100;

  console.log('');
  console.log('='.repeat(66));
  console.log('                 DOOM FIRE BENCHMARK RESULTS');
  console.log('='.repeat(66));
  console.log(`Execution Duration:    ${elapsed_sec.toFixed(3)}s (target: ${DURATION_SEC}s)`);
  console.log(`Total Frames Rendered: ${s_frame_tic.toLocaleString()}`);
  console.log(`Terminal Resolution:  ${term_col} x ${term_row} (Fire Grid: ${FIRE_W} x ${FIRE_H} = ${FIRE_SZ.toLocaleString()} cells)`);
  console.log(`Total Cells Simulated: ${(s_frame_tic * FIRE_SZ).toLocaleString()}`);
  console.log('-'.repeat(66));
  console.log('FRAMERATE (FPS):');
  console.log(`  • Average FPS:       ${avg_fps.toFixed(2)} fps`);
  console.log(`  • Peak FPS:          ${peak_instant_fps.toFixed(2)} fps  (1s sustained peak: ${peak_sec_fps} fps)`);
  console.log(`  • Low FPS (Min):     ${low_instant_fps.toFixed(2)} fps  (1s sustained low:  ${low_sec_fps} fps)`);
  console.log(`  • 1% Low FPS:        ${low_1pct_fps.toFixed(2)} fps`);
  console.log(`  • 0.1% Low FPS:      ${low_01pct_fps.toFixed(2)} fps`);
  console.log('-'.repeat(66));
  console.log('FRAME TIMES (Latency):');
  console.log(`  • Average Frame Time:${avg_dt.toFixed(3)} ms`);
  console.log(`  • Min Frame Time:    ${min_dt.toFixed(3)} ms (Fastest frame)`);
  console.log(`  • Median (p50):      ${p50_dt.toFixed(3)} ms`);
  console.log(`  • 95th Percentile:   ${p95_dt.toFixed(3)} ms`);
  console.log(`  • 99th Percentile:   ${p99_dt.toFixed(3)} ms`);
  console.log(`  • Max Frame Time:    ${max_dt.toFixed(3)} ms (Slowest frame)`);
  console.log('-'.repeat(66));
  if (sec_counts.length > 0) {
    console.log('PER-SECOND BREAKDOWN (FPS):');
    const formattedBuckets = sec_counts
      .map((fps, i) => `Sec ${String(i + 1).padStart(2)}: ${String(fps).padStart(5)} fps`)
      .reduce((rows, item, idx) => {
        if (idx % 2 === 0) rows.push([item]);
        else rows[rows.length - 1].push(item);
        return rows;
      }, [])
      .map(row => '  ' + row.join('   |   '))
      .join('\n');
    console.log(formattedBuckets);
    console.log('-'.repeat(66));
  }
  console.log('TTY DATA & THROUGHPUT:');
  console.log(`  • Total Data Written:${fmtKB(s_sz_total)} (${s_sz_total.toLocaleString()} bytes)`);
  console.log(`  • Transfer Rate:     ${fmtKB(throughput_bytes_sec)}/s`);
  console.log(`  • Frame Payload Size:min ${fmtKB(s_sz_min)} | avg ${fmtKB(avg_payload_bytes)} | max ${fmtKB(s_sz_max)}`);
  console.log('-'.repeat(66));
  console.log('SYSTEM & RESOURCES:');
  console.log(`  • Runtime:           Node.js ${process.version} (${process.platform} ${process.arch})`);
  console.log(`  • CPU Usage:         ${cpu_pct.toFixed(1)}% (User: ${(cpu_used.user / 1000).toFixed(1)}ms | Sys: ${(cpu_used.system / 1000).toFixed(1)}ms)`);
  console.log(`  • Memory (Heap):     ${fmtKB(mem.heapUsed)} used / ${fmtKB(mem.heapTotal)} total (RSS: ${fmtKB(mem.rss)})`);
  console.log('='.repeat(66));
}

// MAIN ///////////////////////
// term prep
stdout.write(screen_buf_on);
stdout.write(cursor_hide);

cpu_start = process.cpuUsage();
time_start = performance.now();
last_frame_time = time_start;

while (performance.now() - time_start < DURATION_MS) {
  drawFrame();
}

const time_end = performance.now();
const cpu_used = process.cpuUsage(cpu_start);
const elapsed_ms = time_end - time_start;
const elapsed_sec = elapsed_ms / 1000;

// term restore
cleanup();

// Report summary
printBenchmarkResults({
  elapsed_sec,
  elapsed_ms,
  frame_times,
  frame_timestamps,
  s_frame_tic,
  s_sz_total,
  s_sz_min,
  s_sz_max,
  cpu_used,
  DURATION_SEC,
  term_col,
  term_row,
  FIRE_W,
  FIRE_H,
  FIRE_SZ
});


