import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { loadEntries, saveEntries, loadPastMemories, savePastMemories } from "./db";

const LAYERS = [
  { id: 1, name: "感情的予期", short: "感情", color: "#E8637A", icon: "💗", desc: "失敗への恐れ、恥の予感、拒絶不安" },
  { id: 2, name: "認知的負荷", short: "認知", color: "#F5A623", icon: "🧠", desc: "完璧主義、「やるべき」と「できない」の乖離" },
  { id: 3, name: "身体的反応", short: "身体", color: "#7ED6A0", icon: "🫁", desc: "胃の重さ、肩の緊張、凍りつき感" },
  { id: 4, name: "関係性の負荷", short: "関係", color: "#6BB5E8", icon: "👥", desc: "期待へのプレッシャー、自己評価の低下" },
  { id: 5, name: "経験の累積", short: "累積", color: "#A78BDB", icon: "📚", desc: "過去の失敗体験の蓄積、「またダメだ」" },
];
const BADGES = [
  { threshold: 1, emoji: "🌱", label: "最初の一歩" },{ threshold: 3, emoji: "🌿", label: "3日連続" },{ threshold: 7, emoji: "🌳", label: "1週間達成" },
  { threshold: 14, emoji: "🌸", label: "2週間の継続" },{ threshold: 30, emoji: "🏆", label: "1ヶ月の探求者" },{ threshold: 50, emoji: "💎", label: "50記録の達人" },{ threshold: 100, emoji: "👑", label: "100記録の王" },
];
const STATUS = { pending: "⏳ 未着手", partial: "🔄 部分着手", started: "✅ 着手", completed: "🎉 完了" };
const STATUS_COLORS = { pending: "#E8637A", partial: "#F5A623", started: "#6BB5E8", completed: "#7ED6A0" };
const defaultEntry = () => ({ id: Date.now(), createdAt: new Date().toISOString(), date: new Date().toISOString().slice(0,10), time: new Date().toTimeString().slice(0,5), task: "", layers: [0,0,0,0,0], totalBurden: 0, sincerity: "", firstStep: "", subtasks: [{text:"",done:false}], bodyLocation: "", thought: "", emotion: "", status: "pending", insight: "", copingUsed: "", updates: [], completedAt: null });
function daysBetween(a,b){return Math.max(0,Math.round((new Date(b)-new Date(a))/86400000))}

function RadarChart({data,size=200}){const ref=useRef(null);useEffect(()=>{if(!ref.current)return;const svg=d3.select(ref.current);svg.selectAll("*").remove();const cx=size/2,cy=size/2,r=size/2-28,g=svg.append("g").attr("transform",`translate(${cx},${cy})`),a=i=>Math.PI*2/5*i-Math.PI/2;[.25,.5,.75,1].forEach(lv=>{const pts=LAYERS.map((_,i)=>[r*lv*Math.cos(a(i)),r*lv*Math.sin(a(i))]);g.append("polygon").attr("points",pts.map(p=>p.join(",")).join(" ")).attr("fill","none").attr("stroke","#e0ddd5").attr("stroke-width",.5)});LAYERS.forEach((l,i)=>{g.append("line").attr("x1",0).attr("y1",0).attr("x2",r*Math.cos(a(i))).attr("y2",r*Math.sin(a(i))).attr("stroke","#e0ddd5").attr("stroke-width",.5);g.append("text").attr("x",(r+16)*Math.cos(a(i))).attr("y",(r+16)*Math.sin(a(i))).attr("text-anchor","middle").attr("dominant-baseline","middle").attr("font-size","10px").attr("fill",l.color).attr("font-weight","600").text(l.icon+l.short)});if(data&&data.some(v=>v>0)){const pts=data.map((v,i)=>[(r*v/10)*Math.cos(a(i)),(r*v/10)*Math.sin(a(i))]);g.append("polygon").attr("points",pts.map(p=>p.join(",")).join(" ")).attr("fill","rgba(200,100,120,.2)").attr("stroke","#E8637A").attr("stroke-width",2);pts.forEach((pt,i)=>{g.append("circle").attr("cx",pt[0]).attr("cy",pt[1]).attr("r",3.5).attr("fill",LAYERS[i].color).attr("stroke","#fff").attr("stroke-width",1.5)});}},[data,size]);return <svg ref={ref} width={size} height={size}/>}

function TrendChart({entries}){const ref=useRef(null);useEffect(()=>{if(!ref.current||entries.length<2)return;const svg=d3.select(ref.current);svg.selectAll("*").remove();const w=340,h=150,m={t:20,r:15,b:28,l:32},recent=entries.slice(-14),x=d3.scalePoint().domain(recent.map((_,i)=>i)).range([m.l,w-m.r]),y=d3.scaleLinear().domain([0,50]).range([h-m.b,m.t]),g=svg.append("g");g.append("g").attr("transform",`translate(0,${h-m.b})`).call(d3.axisBottom(x).tickFormat(i=>recent[i]?.date?.slice(5)||"")).selectAll("text").attr("font-size","8px").attr("fill","#999");g.append("g").attr("transform",`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5)).selectAll("text").attr("font-size","8px").attr("fill","#999");g.append("path").datum(recent).attr("d",d3.line().x((_,i)=>x(i)).y(d=>y(d.totalBurden)).curve(d3.curveMonotoneX)).attr("fill","none").attr("stroke","#E8637A").attr("stroke-width",2);recent.forEach((d,i)=>{g.append("circle").attr("cx",x(i)).attr("cy",y(d.totalBurden)).attr("r",3).attr("fill","#E8637A")})},[entries]);if(entries.length<2)return <p style={{color:"#999",fontSize:13,textAlign:"center"}}>2件以上でトレンド表示</p>;return <svg ref={ref} width={340} height={150}/>}

function LayerSlider({layer,value,onChange}){
  const barRef = useRef(null);
  const handleInteraction = useCallback((clientX) => {
    if (!barRef.current) return;
    const r = barRef.current.getBoundingClientRect();
    const v = Math.round(Math.max(0, Math.min(10, (clientX - r.left) / r.width * 10)));
    onChange(v);
  }, [onChange]);

  return(<div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
      <span style={{fontSize:12,fontWeight:600,color:layer.color}}>{layer.icon} {layer.name}</span>
      <span style={{fontSize:16,fontWeight:700,color:value>7?"#E8637A":value>4?"#F5A623":"#7ED6A0"}}>{value}</span>
    </div>
    <div ref={barRef} style={{position:"relative",height:32,background:"#f5f3ee",borderRadius:16,overflow:"hidden",cursor:"pointer",touchAction:"none"}}
      onClick={e => handleInteraction(e.clientX)}
      onTouchStart={e => { e.preventDefault(); handleInteraction(e.touches[0].clientX); }}
      onTouchMove={e => { e.preventDefault(); handleInteraction(e.touches[0].clientX); }}
    >
      <div style={{height:"100%",width:`${value*10}%`,background:`linear-gradient(90deg,${layer.color}44,${layer.color})`,borderRadius:16,transition:"width .15s"}}/>
      <div style={{position:"absolute",top:2,left:`calc(${value*10}% - 14px)`,width:28,height:28,borderRadius:14,background:"#fff",boxShadow:"0 2px 6px rgba(0,0,0,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,transition:"left .15s"}}>{layer.icon}</div>
    </div>
    <p style={{fontSize:10,color:"#aaa",margin:"2px 0 0"}}>{layer.desc}</p>
  </div>);
}

function ExportButton({ entries, pastMemories }) {
  const handleExport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      entries,
      pastMemories,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ab-tracker-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={handleExport} style={{width:"100%",padding:"11px",border:"1.5px solid #2E8B8B",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",background:"#fff",color:"#2E8B8B",marginTop:8}}>
      📥 データをエクスポート（JSON）
    </button>
  );
}

export default function App(){
  const[entries,setEntries]=useState([]);const[current,setCurrent]=useState(defaultEntry());const[view,setView]=useState("record");const[showBadge,setShowBadge]=useState(null);const[pastMemories,setPastMemories]=useState([]);const[pastInput,setPastInput]=useState({period:"",event:"",type:"uncompleted",burden:0,emotion:"",impact:""});const[detailId,setDetailId]=useState(null);const[updateNote,setUpdateNote]=useState("");const[dbReady,setDbReady]=useState(false);
  const[editMode,setEditMode]=useState(false);const[editData,setEditData]=useState(null);
  const[reEvalMode,setReEvalMode]=useState(false);const[reEvalLayers,setReEvalLayers]=useState([0,0,0,0,0]);
  const[noiseReEvalMode,setNoiseReEvalMode]=useState(false);const[noiseReEvalValue,setNoiseReEvalValue]=useState(0);

  // Load from IndexedDB on mount
  useEffect(()=>{
    (async()=>{
      const [e,p] = await Promise.all([loadEntries(), loadPastMemories()]);
      setEntries(e);
      setPastMemories(p);
      setDbReady(true);
    })();
  },[]);

  // Persist entries to IndexedDB
  useEffect(()=>{
    if(dbReady) saveEntries(entries);
  },[entries,dbReady]);

  // Persist pastMemories to IndexedDB
  useEffect(()=>{
    if(dbReady) savePastMemories(pastMemories);
  },[pastMemories,dbReady]);

  const totalBurden=current.layers.reduce((a,b)=>a+b,0);
  const streak=(()=>{let c=0;const dates=[...new Set(entries.map(e=>e.date))].sort().reverse();for(let i=0;i<dates.length;i++){if(dates[i]===new Date(Date.now()-i*86400000).toISOString().slice(0,10))c++;else break}return c})();
  const earnedBadges=BADGES.filter(b=>entries.length>=b.threshold);const detailEntry=detailId?entries.find(e=>e.id===detailId):null;const completedCount=entries.filter(e=>e.status==="completed").length;
  const avgDays=(()=>{const d=entries.filter(e=>e.status==="completed"&&e.completedAt);return d.length===0?"-":(d.reduce((a,e)=>a+daysBetween(e.createdAt,e.completedAt),0)/d.length).toFixed(1)})();
  const saveEntry=()=>{if(!current.task)return;const e={...current,totalBurden,id:Date.now(),createdAt:new Date().toISOString()};const ne=[...entries,e];setEntries(ne);const nb=BADGES.find(b=>b.threshold===ne.length);if(nb){setShowBadge(nb);setTimeout(()=>setShowBadge(null),3000)}setCurrent(defaultEntry())};
  const updateEntry=(id,u)=>setEntries(entries.map(e=>e.id===id?{...e,...u}:e));
  const addUpdate=id=>{if(!updateNote.trim())return;const e=entries.find(x=>x.id===id);updateEntry(id,{updates:[...(e.updates||[]),{date:new Date().toISOString(),note:updateNote,status:e.status}]});setUpdateNote("")};
  const changeStatus=(id,ns)=>{const e=entries.find(x=>x.id===id);const u={date:new Date().toISOString(),note:`ステータス: ${STATUS[e.status]} → ${STATUS[ns]}`,status:ns};updateEntry(id,{status:ns,completedAt:ns==="completed"?new Date().toISOString():e.completedAt,updates:[...(e.updates||[]),u]})};
  const toggleSubtask=(eid,idx)=>{const e=entries.find(x=>x.id===eid);const ns=e.subtasks.map((s,i)=>i===idx?{...s,done:!s.done}:s);updateEntry(eid,{subtasks:ns})};
  const savePast=()=>{if(!pastInput.event)return;const pid=Date.now();const pe={id:pid,createdAt:new Date().toISOString(),date:new Date().toISOString().slice(0,10),time:new Date().toTimeString().slice(0,5),task:pastInput.event,layers:[0,0,0,0,pastInput.burden],totalBurden:pastInput.burden,sincerity:"",firstStep:"",subtasks:[{text:"",done:false}],bodyLocation:"",thought:"",emotion:pastInput.emotion,status:pastInput.type==="uncompleted"?"pending":"partial",insight:pastInput.impact,copingUsed:"",updates:[{date:new Date().toISOString(),note:"[過去の体験] 時期: "+(pastInput.period||"不明")+" | タイプ: "+(pastInput.type==="uncompleted"?"着手・完了できず":"完了したが不満足")+" | ノイズ: "+pastInput.burden+"/10"+(pastInput.impact?" | 今への影響: "+pastInput.impact:""),status:pastInput.type==="uncompleted"?"pending":"partial"}],completedAt:null,isPast:true,period:pastInput.period,noiseLevel:pastInput.burden};setEntries([...entries,pe]);setPastMemories([...pastMemories,{...pastInput,id:pid}]);setPastInput({period:"",event:"",type:"uncompleted",burden:0,emotion:"",impact:""})};
  const startEdit=(e)=>{setEditData({task:e.task,sincerity:e.sincerity||"",firstStep:e.firstStep||"",bodyLocation:e.bodyLocation||"",thought:e.thought||"",emotion:e.emotion||"",copingUsed:e.copingUsed||"",insight:e.insight||""});setEditMode(true)};
  const saveEdit=(id)=>{if(!editData)return;const e=entries.find(x=>x.id===id);const changes=[];if(editData.task!==e.task)changes.push(`課題: ${e.task} → ${editData.task}`);["sincerity","firstStep","bodyLocation","thought","emotion","copingUsed","insight"].forEach(k=>{if((editData[k]||"")!==(e[k]||""))changes.push(`${k}を更新`)});if(changes.length>0){const u={date:new Date().toISOString(),note:"[編集] "+changes.join(", "),status:e.status};updateEntry(id,{...editData,updates:[...(e.updates||[]),u]})}else{updateEntry(id,editData)}setEditMode(false);setEditData(null)};
  const startReEval=(e)=>{setReEvalLayers([...e.layers]);setReEvalMode(true)};
  const saveReEval=(id)=>{const e=entries.find(x=>x.id===id);const oldTotal=e.totalBurden;const newTotal=reEvalLayers.reduce((a,b)=>a+b,0);const diff=newTotal-oldTotal;const diffStr=diff>0?`+${diff}`:String(diff);const u={date:new Date().toISOString(),note:`[再評価] AB: ${oldTotal} → ${newTotal}（${diffStr}）`,status:e.status};updateEntry(id,{layers:[...reEvalLayers],totalBurden:newTotal,updates:[...(e.updates||[]),u]});setReEvalMode(false)};
  const startNoiseReEval=(e)=>{setNoiseReEvalValue(e.noiseLevel||0);setNoiseReEvalMode(true)};
  const saveNoiseReEval=(id)=>{const e=entries.find(x=>x.id===id);const oldNoise=e.noiseLevel||0;const diff=noiseReEvalValue-oldNoise;const diffStr=diff>0?`+${diff}`:String(diff);const u={date:new Date().toISOString(),note:`[ノイズ再評価] ノイズ: ${oldNoise} → ${noiseReEvalValue}（${diffStr}）`,status:e.status};updateEntry(id,{noiseLevel:noiseReEvalValue,updates:[...(e.updates||[]),u]});const pm=pastMemories.find(m=>m.id===id);if(pm){setPastMemories(pastMemories.map(m=>m.id===id?{...m,burden:noiseReEvalValue}:m))}setNoiseReEvalMode(false)};
  const bc=totalBurden>35?"#E8637A":totalBurden>20?"#F5A623":totalBurden>10?"#6BB5E8":"#7ED6A0";
  const S={card:{background:"#fff",borderRadius:14,padding:18,marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,.06)"},inp:{width:"100%",padding:"9px 11px",border:"2px solid #e8e4db",borderRadius:9,fontSize:13,boxSizing:"border-box",outline:"none"},inpG:{width:"100%",padding:"9px 11px",border:"2px solid #d0ece8",borderRadius:9,fontSize:13,boxSizing:"border-box",outline:"none"},lbl:{fontSize:12,fontWeight:700,color:"#1B2A4A",display:"block",marginBottom:3}};

  // DETAIL VIEW
  if(detailEntry){const days=detailEntry.completedAt?daysBetween(detailEntry.createdAt,detailEntry.completedAt):daysBetween(detailEntry.createdAt,new Date().toISOString());const stD=(detailEntry.subtasks||[]).filter(s=>s.done).length;const stT=(detailEntry.subtasks||[]).filter(s=>s.text?.trim()).length;
  const reEvalTotal=reEvalLayers.reduce((a,b)=>a+b,0);const reEvalDiff=reEvalTotal-detailEntry.totalBurden;
  const editInpStyle={...S.inp,border:"2px solid #6BB5E8",background:"#f8fbff"};
  const DETAIL_FIELDS=[{k:"bodyLocation",l:"身体感覚",p:"例：胃のあたりが重い"},{k:"thought",l:"思考",p:"例：どうせまたできない…"},{k:"emotion",l:"感情",p:"例：恐怖、恥、焦り"},{k:"copingUsed",l:"コーピング",p:"例：深呼吸、散歩、分割"},{k:"insight",l:"気づき",p:"例：締切3日前から身体が…"}];
  return(<div style={{minHeight:"100vh",background:"linear-gradient(160deg,#faf9f6,#f0ede6,#e8e4db)",fontFamily:"'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif"}}><div style={{maxWidth:420,margin:"0 auto",padding:"16px 16px 100px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <button onClick={()=>{setDetailId(null);setEditMode(false);setEditData(null);setReEvalMode(false);setNoiseReEvalMode(false)}} style={{background:"none",border:"none",fontSize:14,color:"#2E8B8B",fontWeight:600,cursor:"pointer",padding:"8px 0"}}>← 一覧に戻る</button>
      {!editMode&&!reEvalMode&&!noiseReEvalMode&&<button onClick={()=>startEdit(detailEntry)} style={{padding:"6px 14px",border:"1.5px solid #6BB5E8",borderRadius:8,fontSize:12,fontWeight:600,background:"#fff",color:"#6BB5E8",cursor:"pointer"}}>✏️ 編集モード</button>}
      {editMode&&<div style={{display:"flex",gap:4}}><button onClick={()=>{setEditMode(false);setEditData(null)}} style={{padding:"6px 12px",border:"1.5px solid #e8e4db",borderRadius:8,fontSize:12,fontWeight:600,background:"#fff",color:"#999",cursor:"pointer"}}>キャンセル</button><button onClick={()=>saveEdit(detailEntry.id)} style={{padding:"6px 12px",border:"none",borderRadius:8,fontSize:12,fontWeight:700,background:"#6BB5E8",color:"#fff",cursor:"pointer"}}>保存</button></div>}
    </div>

    {/* Header card */}
    <div style={S.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        {editMode?<input value={editData.task} onChange={e=>setEditData({...editData,task:e.target.value})} style={{...editInpStyle,fontSize:16,fontWeight:700,flex:1,marginRight:8}}/>:<h2 style={{fontSize:17,fontWeight:700,color:"#1B2A4A",margin:0}}>{detailEntry.task}</h2>}
        <span style={{fontSize:12,fontWeight:700,color:STATUS_COLORS[detailEntry.status],background:STATUS_COLORS[detailEntry.status]+"18",padding:"4px 10px",borderRadius:8,whiteSpace:"nowrap"}}>{STATUS[detailEntry.status]}</span>
      </div>
      <div style={{fontSize:12,color:"#999",marginBottom:12}}>作成: {detailEntry.date} {detailEntry.time} | 経過: {days}日{detailEntry.completedAt&&<span style={{color:"#7ED6A0",fontWeight:600}}> | {daysBetween(detailEntry.createdAt,detailEntry.completedAt)}日で完了</span>}</div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{Object.keys(STATUS).map(s=>(<button key={s} onClick={()=>changeStatus(detailEntry.id,s)} style={{padding:"6px 10px",border:detailEntry.status===s?`2px solid ${STATUS_COLORS[s]}`:"1.5px solid #e8e4db",borderRadius:8,fontSize:11,fontWeight:detailEntry.status===s?700:400,background:detailEntry.status===s?STATUS_COLORS[s]+"15":"#fff",color:detailEntry.status===s?STATUS_COLORS[s]:"#999",cursor:"pointer"}}>{STATUS[s]}</button>))}</div>
    </div>

    {/* Radar + AB score + Re-evaluation */}
    <div style={{...S.card,display:"flex",flexDirection:"column",alignItems:"center"}}>
      <RadarChart data={reEvalMode?reEvalLayers:detailEntry.layers} size={180}/>
      <div style={{fontSize:24,fontWeight:800,color:detailEntry.totalBurden>35?"#E8637A":detailEntry.totalBurden>20?"#F5A623":"#7ED6A0"}}>AB: {detailEntry.totalBurden}<span style={{fontSize:12,color:"#999"}}>/50</span></div>
      {!reEvalMode&&!detailEntry.isPast&&<button onClick={()=>startReEval(detailEntry)} style={{marginTop:10,padding:"8px 18px",border:"1.5px solid #E8637A",borderRadius:8,fontSize:12,fontWeight:600,background:"#fff",color:"#E8637A",cursor:"pointer"}}>🔄 再評価する</button>}
    </div>

    {/* Re-evaluation panel */}
    {reEvalMode&&<div style={{...S.card,background:"linear-gradient(135deg,#fff,#fff5f5)",border:"2px solid #E8637A33"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#E8637A",margin:"0 0 4px"}}>🔄 予期負担の再評価</h3>
      <p style={{fontSize:10,color:"#999",margin:"0 0 12px"}}>現在の感覚で5層を再入力してください</p>
      {LAYERS.map((l,i)=>(<LayerSlider key={l.id} layer={l} value={reEvalLayers[i]} onChange={v=>{const nl=[...reEvalLayers];nl[i]=Math.max(0,Math.min(10,v));setReEvalLayers(nl)}}/>))}
      <div style={{textAlign:"center",margin:"12px 0 8px"}}>
        <span style={{fontSize:22,fontWeight:800,color:reEvalTotal>35?"#E8637A":reEvalTotal>20?"#F5A623":"#7ED6A0"}}>{reEvalTotal}</span>
        <span style={{fontSize:12,color:"#999"}}>/50</span>
        <span style={{fontSize:16,fontWeight:700,marginLeft:12,color:reEvalDiff>0?"#E8637A":reEvalDiff<0?"#7ED6A0":"#999"}}>{detailEntry.totalBurden} → {reEvalTotal}（{reEvalDiff>0?"+":"" }{reEvalDiff}）</span>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setReEvalMode(false)} style={{flex:1,padding:"10px",border:"1.5px solid #e8e4db",borderRadius:8,fontSize:13,fontWeight:600,background:"#fff",color:"#999",cursor:"pointer"}}>キャンセル</button>
        <button onClick={()=>saveReEval(detailEntry.id)} style={{flex:1,padding:"10px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#E8637A,#c0506a)",color:"#fff",cursor:"pointer"}}>再評価を保存</button>
      </div>
    </div>}

    {/* Noise re-evaluation for past experiences */}
    {detailEntry.isPast&&!noiseReEvalMode&&<div style={S.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><span style={{fontSize:13,fontWeight:700,color:"#A78BDB"}}>ノイズ度合い: </span><span style={{fontSize:20,fontWeight:800,color:(detailEntry.noiseLevel||0)>7?"#E8637A":(detailEntry.noiseLevel||0)>4?"#F5A623":"#7ED6A0"}}>{detailEntry.noiseLevel||0}</span><span style={{fontSize:12,color:"#999"}}>/10</span></div>
        <button onClick={()=>startNoiseReEval(detailEntry)} style={{padding:"8px 14px",border:"1.5px solid #A78BDB",borderRadius:8,fontSize:12,fontWeight:600,background:"#fff",color:"#A78BDB",cursor:"pointer"}}>🔄 ノイズ再評価</button>
      </div>
    </div>}
    {noiseReEvalMode&&<div style={{...S.card,background:"linear-gradient(135deg,#fff,#f8f5ff)",border:"2px solid #A78BDB33"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#A78BDB",margin:"0 0 4px"}}>🔄 ノイズ再評価</h3>
      <p style={{fontSize:10,color:"#999",margin:"0 0 10px"}}>今のノイズ度合いを再評価してください</p>
      <div style={{display:"flex",gap:3,marginBottom:10}}>{[0,1,2,3,4,5,6,7,8,9,10].map(n=>(<button key={n} onClick={()=>setNoiseReEvalValue(n)} style={{flex:1,padding:"8px 0",border:"none",borderRadius:6,fontSize:13,fontWeight:noiseReEvalValue===n?700:400,background:noiseReEvalValue===n?(n>7?"#E8637A":n>4?"#F5A623":"#7ED6A0"):"#f5f3ee",color:noiseReEvalValue===n?"#fff":"#666",cursor:"pointer"}}>{n}</button>))}</div>
      {(()=>{const oldN=detailEntry.noiseLevel||0;const diff=noiseReEvalValue-oldN;return <div style={{textAlign:"center",margin:"8px 0",fontSize:15,fontWeight:700,color:diff>0?"#E8637A":diff<0?"#7ED6A0":"#999"}}>ノイズ: {oldN} → {noiseReEvalValue}（{diff>0?"+":""}{diff}）</div>})()}
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setNoiseReEvalMode(false)} style={{flex:1,padding:"10px",border:"1.5px solid #e8e4db",borderRadius:8,fontSize:13,fontWeight:600,background:"#fff",color:"#999",cursor:"pointer"}}>キャンセル</button>
        <button onClick={()=>saveNoiseReEval(detailEntry.id)} style={{flex:1,padding:"10px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#A78BDB,#1B2A4A)",color:"#fff",cursor:"pointer"}}>再評価を保存</button>
      </div>
    </div>}

    {/* Bridge section */}
    {(detailEntry.sincerity||detailEntry.firstStep||stT>0)&&<div style={{...S.card,background:"linear-gradient(135deg,#fff,#f0faf8)",border:"1px solid #d0ece8"}}><h3 style={{fontSize:14,fontWeight:700,color:"#2E8B8B",margin:"0 0 10px"}}>🌿 着手への橋渡し</h3>
      {editMode?<div style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:600,color:"#666",display:"block",marginBottom:2}}>誠実でありたいこと</label><input value={editData.sincerity} onChange={e=>setEditData({...editData,sincerity:e.target.value})} style={editInpStyle}/></div>
      :detailEntry.sincerity&&<div style={{marginBottom:8}}><span style={{fontSize:11,fontWeight:600,color:"#666"}}>誠実でありたいこと：</span><p style={{fontSize:13,color:"#1B2A4A",margin:"2px 0",fontWeight:500}}>{detailEntry.sincerity}</p></div>}
      {editMode?<div style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:600,color:"#666",display:"block",marginBottom:2}}>最初の一歩</label><input value={editData.firstStep} onChange={e=>setEditData({...editData,firstStep:e.target.value})} style={editInpStyle}/></div>
      :detailEntry.firstStep&&<div style={{marginBottom:8}}><span style={{fontSize:11,fontWeight:600,color:"#666"}}>最初の一歩：</span><p style={{fontSize:13,color:"#1B2A4A",margin:"2px 0",fontWeight:500}}>{detailEntry.firstStep}</p></div>}
      {stT>0&&<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:11,fontWeight:600,color:"#666"}}>細分化した要素：</span><span style={{fontSize:13,fontWeight:700,color:"#2E8B8B"}}>{stD}/{stT}</span></div>
        <div style={{height:6,background:"#e8e4db",borderRadius:3,marginBottom:8}}><div style={{height:"100%",width:stT>0?`${stD/stT*100}%`:"0%",background:"linear-gradient(90deg,#2E8B8B,#7ED6A0)",borderRadius:3,transition:"width .5s"}}/></div>
        {detailEntry.subtasks.filter(s=>s.text?.trim()).map((s,i)=>(<div key={i} onClick={()=>toggleSubtask(detailEntry.id,i)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:s.done?"#f0faf8":"#fff",borderRadius:8,marginBottom:4,cursor:"pointer",border:"1px solid #e8e4db"}}><span style={{fontSize:16}}>{s.done?"✅":"⬜"}</span><span style={{fontSize:13,color:s.done?"#7ED6A0":"#333",textDecoration:s.done?"line-through":"none",fontWeight:s.done?400:500}}>{s.text}</span></div>))}</div>}</div>}

    {/* Record content - edit mode or display mode */}
    <div style={S.card}><h3 style={{fontSize:14,fontWeight:700,color:"#1B2A4A",margin:"0 0 10px"}}>{editMode?"✏️ 記録内容を編集":"📋 記録内容"}</h3>
      {editMode?DETAIL_FIELDS.map(f=>(<div key={f.k} style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:600,color:"#666",display:"block",marginBottom:2}}>{f.l}</label><input value={editData[f.k]} onChange={e=>setEditData({...editData,[f.k]:e.target.value})} placeholder={f.p} style={editInpStyle}/></div>))
      :DETAIL_FIELDS.filter(f=>detailEntry[f.k]).map(f=>(<div key={f.k} style={{marginBottom:6}}><span style={{fontSize:11,fontWeight:600,color:"#999"}}>{f.l}：</span><span style={{fontSize:13,color:"#333"}}>{detailEntry[f.k]}</span></div>))}
      {!editMode&&DETAIL_FIELDS.every(f=>!detailEntry[f.k])&&<p style={{fontSize:12,color:"#999"}}>詳細記録なし</p>}
    </div>

    {/* Timeline */}
    <div style={S.card}><h3 style={{fontSize:14,fontWeight:700,color:"#1B2A4A",margin:"0 0 10px"}}>📝 経過・追記</h3>
      {(detailEntry.updates||[]).length===0&&<p style={{fontSize:12,color:"#999"}}>まだ追記はありません</p>}
      {(detailEntry.updates||[]).map((u,i)=>{const isReEval=u.note?.startsWith("[再評価]");const isNoise=u.note?.startsWith("[ノイズ再評価]");const isEdit=u.note?.startsWith("[編集]");const borderColor=isReEval?"#E8637A":isNoise?"#A78BDB":isEdit?"#6BB5E8":STATUS_COLORS[u.status]||"#ccc";
      return(<div key={i} style={{borderLeft:`3px solid ${borderColor}`,paddingLeft:12,marginBottom:10,paddingBottom:6,borderBottom:"1px solid #f5f3ee"}}><div style={{fontSize:11,color:"#999"}}>{new Date(u.date).toLocaleDateString("ja-JP")} {new Date(u.date).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}</div><div style={{fontSize:13,color:isReEval||isNoise?"#333":"#333",fontWeight:isReEval||isNoise?600:400,marginTop:2}}>{u.note}</div></div>)})}
      <div style={{marginTop:10,display:"flex",gap:6}}><input value={updateNote} onChange={e=>setUpdateNote(e.target.value)} placeholder="追記・メモを入力..." style={{flex:1,padding:"8px 10px",border:"1.5px solid #e8e4db",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor="#2E8B8B"} onBlur={e=>e.target.style.borderColor="#e8e4db"} onKeyDown={e=>{if(e.key==="Enter")addUpdate(detailEntry.id)}}/><button onClick={()=>addUpdate(detailEntry.id)} style={{padding:"8px 14px",border:"none",borderRadius:8,background:"#2E8B8B",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>追記</button></div></div>
  </div></div>)}

  // MAIN
  return(<div style={{minHeight:"100vh",background:"linear-gradient(160deg,#faf9f6,#f0ede6,#e8e4db)",fontFamily:"'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif"}}>
    {showBadge&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"#fff",borderRadius:24,padding:"40px 48px",textAlign:"center",animation:"pop .5s ease"}}><div style={{fontSize:64}}>{showBadge.emoji}</div><p style={{fontSize:20,fontWeight:700,color:"#1B2A4A",margin:"12px 0 4px"}}>バッジ獲得！</p><p style={{fontSize:15,color:"#666"}}>{showBadge.label}</p></div></div>}
    <div style={{maxWidth:420,margin:"0 auto",padding:"16px 16px 100px"}}>
      <div style={{textAlign:"center",padding:"16px 0 10px"}}><h1 style={{fontSize:22,fontWeight:800,color:"#1B2A4A",margin:0,letterSpacing:1}}>予期負担モニター</h1><p style={{fontSize:11,color:"#999",margin:"3px 0 0"}}>Anticipatory Burden Tracker</p></div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>{[{l:"記録",v:entries.length,e:"📝"},{l:"連続",v:`${streak}日`,e:"🔥"},{l:"完了",v:completedCount,e:"🎉"},{l:"平均日数",v:avgDays,e:"⏱️"},{l:"バッジ",v:earnedBadges.length,e:"🏅"}].map((s,i)=>(<div key={i} style={{flex:1,background:"#fff",borderRadius:10,padding:"8px 2px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}><div style={{fontSize:16}}>{s.e}</div><div style={{fontSize:14,fontWeight:700,color:"#1B2A4A"}}>{s.v}</div><div style={{fontSize:9,color:"#999"}}>{s.l}</div></div>))}</div>
      <div style={{display:"flex",background:"#fff",borderRadius:10,padding:3,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>{[{id:"record",l:"📝 記録"},{id:"list",l:"📋 履歴"},{id:"past",l:"📚 過去"},{id:"analysis",l:"📊 分析"}].map(t=>(<button key={t.id} onClick={()=>setView(t.id)} style={{flex:1,padding:"9px 2px",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:view===t.id?700:400,background:view===t.id?"#1B2A4A":"transparent",color:view===t.id?"#fff":"#666",transition:"all .2s"}}>{t.l}</button>))}</div>

      {view==="record"&&<div>
        <div style={S.card}><label style={S.lbl}>何を先延ばしそう？ / 取り組もうとしている課題</label><input value={current.task} onChange={e=>setCurrent({...current,task:e.target.value})} placeholder="例：確定申告の書類整理" style={S.inp} onFocus={e=>e.target.style.borderColor="#2E8B8B"} onBlur={e=>e.target.style.borderColor="#e8e4db"}/></div>
        <div style={S.card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={{fontSize:14,fontWeight:700,color:"#1B2A4A",margin:0}}>5層の予期負担</h3><div style={{fontSize:26,fontWeight:800,color:bc}}>{totalBurden}<span style={{fontSize:12,color:"#999"}}>/50</span></div></div>{LAYERS.map((l,i)=>(<LayerSlider key={l.id} layer={l} value={current.layers[i]} onChange={v=>{const nl=[...current.layers];nl[i]=Math.max(0,Math.min(10,v));setCurrent({...current,layers:nl})}}/>))}</div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><RadarChart data={current.layers}/></div>
        <div style={{...S.card,background:"linear-gradient(135deg,#fff,#f0faf8)",border:"1px solid #d0ece8"}}><h3 style={{fontSize:14,fontWeight:700,color:"#2E8B8B",margin:"0 0 3px"}}>🌿 着手への橋渡し</h3><p style={{fontSize:10,color:"#999",margin:"0 0 12px"}}>予期負担を感じたまま、小さく動き出すために</p>
          <div style={{marginBottom:12}}><label style={S.lbl}>1. 何に対して誠実でありたいか？</label><input value={current.sincerity} onChange={e=>setCurrent({...current,sincerity:e.target.value})} placeholder="例：家族の安心のために" style={S.inpG} onFocus={e=>e.target.style.borderColor="#2E8B8B"} onBlur={e=>e.target.style.borderColor="#d0ece8"}/></div>
          <div style={{marginBottom:12}}><label style={S.lbl}>2. 何から始めるか？（5分でできる最小の一歩）</label><input value={current.firstStep} onChange={e=>setCurrent({...current,firstStep:e.target.value})} placeholder="例：書類を1枚だけ机に出す" style={S.inpG} onFocus={e=>e.target.style.borderColor="#2E8B8B"} onBlur={e=>e.target.style.borderColor="#d0ece8"}/></div>
          <div><label style={S.lbl}>3. 細分化するといくつの要素？</label>{current.subtasks.map((st,idx)=>(<div key={idx} style={{display:"flex",gap:5,marginBottom:5,alignItems:"center"}}><span style={{fontSize:12,fontWeight:700,color:"#2E8B8B",width:20,textAlign:"center"}}>{idx+1}</span><input value={st.text||""} onChange={e=>{const ns=[...current.subtasks];ns[idx]={text:e.target.value,done:false};setCurrent({...current,subtasks:ns})}} placeholder={idx===0?"例：領収書を集める":""} style={{flex:1,padding:"7px 9px",border:"1.5px solid #d0ece8",borderRadius:7,fontSize:12,boxSizing:"border-box",outline:"none"}} onFocus={e=>e.target.style.borderColor="#2E8B8B"} onBlur={e=>e.target.style.borderColor="#d0ece8"}/>{current.subtasks.length>1&&<button onClick={()=>setCurrent({...current,subtasks:current.subtasks.filter((_,i)=>i!==idx)})} style={{width:26,height:26,border:"none",borderRadius:7,background:"#f5f3ee",cursor:"pointer",fontSize:13,color:"#999"}}>×</button>}</div>))}
            <button onClick={()=>setCurrent({...current,subtasks:[...current.subtasks,{text:"",done:false}]})} style={{width:"100%",padding:"7px",border:"1.5px dashed #d0ece8",borderRadius:7,background:"transparent",cursor:"pointer",fontSize:11,color:"#2E8B8B",fontWeight:600,marginTop:3}}>＋ 要素を追加</button>
            <div style={{textAlign:"right",marginTop:4}}><span style={{fontSize:12,fontWeight:700,color:"#2E8B8B"}}>{current.subtasks.filter(s=>s.text?.trim()).length} 要素</span><span style={{fontSize:10,color:"#999"}}> に分解</span></div></div></div>
        <div style={S.card}><h3 style={{fontSize:14,fontWeight:700,color:"#1B2A4A",margin:"0 0 10px"}}>詳細記録</h3>{[{k:"bodyLocation",l:"身体のどこに感じる？",p:"例：胃のあたりが重い"},{k:"thought",l:"頭に浮かんでいる思考",p:"例：どうせまたできない…"},{k:"emotion",l:"感情に名前をつけると？",p:"例：恐怖、恥、焦り"},{k:"copingUsed",l:"試したコーピング",p:"例：深呼吸、散歩、分割"},{k:"insight",l:"気づき・発見",p:"例：締切3日前から身体が…"}].map(f=>(<div key={f.k} style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:600,color:"#666",display:"block",marginBottom:2}}>{f.l}</label><input value={current[f.k]} onChange={e=>setCurrent({...current,[f.k]:e.target.value})} placeholder={f.p} style={{...S.inp,border:"1.5px solid #e8e4db",fontSize:12}} onFocus={e=>e.target.style.borderColor="#2E8B8B"} onBlur={e=>e.target.style.borderColor="#e8e4db"}/></div>))}</div>
        <button onClick={saveEntry} disabled={!current.task} style={{width:"100%",padding:"13px",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:current.task?"pointer":"default",background:current.task?"linear-gradient(135deg,#2E8B8B,#1B2A4A)":"#ccc",color:"#fff",boxShadow:current.task?"0 4px 12px rgba(46,139,139,.3)":"none"}}>📝 記録を保存する</button>
      </div>}

      {view==="list"&&<div>{entries.length===0&&<p style={{textAlign:"center",color:"#999",fontSize:13,marginTop:40}}>まだ記録がありません</p>}
        {[...entries].reverse().map(e=>{const days=e.completedAt?daysBetween(e.createdAt,e.completedAt):daysBetween(e.createdAt,new Date().toISOString());const stD=(e.subtasks||[]).filter(s=>s.done).length;const stT=(e.subtasks||[]).filter(s=>s.text?.trim()).length;
        return(<div key={e.id} onClick={()=>setDetailId(e.id)} style={{background:e.isPast?"linear-gradient(135deg,#fff,#f8f5ff)":"#fff",borderRadius:12,padding:14,marginBottom:8,boxShadow:"0 1px 4px rgba(0,0,0,.06)",cursor:"pointer",borderLeft:`4px solid ${e.isPast?"#A78BDB":STATUS_COLORS[e.status]}`,transition:"transform .2s"}} onMouseEnter={ev=>ev.currentTarget.style.transform="translateX(4px)"} onMouseLeave={ev=>ev.currentTarget.style.transform="none"}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:6}}>{e.isPast&&<span style={{fontSize:9,fontWeight:700,color:"#A78BDB",background:"#A78BDB15",padding:"2px 6px",borderRadius:4}}>過去</span>}<span style={{fontSize:14,fontWeight:600,color:"#1B2A4A"}}>{e.task}</span></div><span style={{fontSize:10,fontWeight:600,color:STATUS_COLORS[e.status],background:STATUS_COLORS[e.status]+"15",padding:"2px 8px",borderRadius:6}}>{STATUS[e.status]}</span></div>
          <div style={{display:"flex",gap:12,marginTop:6,fontSize:11,color:"#999"}}>{e.isPast&&e.period?<span>📚{e.period}</span>:<span>AB: <b style={{color:e.totalBurden>35?"#E8637A":e.totalBurden>20?"#F5A623":"#7ED6A0"}}>{e.totalBurden}</b></span>}<span>{e.date}</span><span>{days}日{e.completedAt?"で完了":"経過"}</span>{stT>0&&<span>{stD}/{stT}完了</span>}{(e.updates||[]).length>0&&<span>💬{e.updates.length}</span>}</div></div>)})}
        <ExportButton entries={entries} pastMemories={pastMemories} />
      </div>}

      {view==="past"&&<div><div style={S.card}><h3 style={{fontSize:14,fontWeight:700,color:"#1B2A4A",margin:"0 0 3px"}}>先延ばし体験の棚卸し</h3><p style={{fontSize:11,color:"#999",margin:"0 0 14px"}}>直近から幼少期まで。未完了のノイズを可視化する。</p>
        {[{k:"period",l:"時期",p:"例：大学3年（2005年頃）"},{k:"event",l:"出来事・課題",p:"例：卒業論文の提出"}].map(f=>(<div key={f.k} style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:600,color:"#666",display:"block",marginBottom:2}}>{f.l}</label><input value={pastInput[f.k]} onChange={e=>setPastInput({...pastInput,[f.k]:e.target.value})} placeholder={f.p} style={{...S.inp,border:"1.5px solid #e8e4db"}} onFocus={e=>e.target.style.borderColor="#A78BDB"} onBlur={e=>e.target.style.borderColor="#e8e4db"}/></div>))}
        <div style={{display:"flex",gap:6,marginBottom:8}}>{[{v:"uncompleted",l:"❌ 着手・完了できず"},{v:"unsatisfied",l:"😔 完了したが不満足"}].map(t=>(<button key={t.v} onClick={()=>setPastInput({...pastInput,type:t.v})} style={{flex:1,padding:"9px 4px",border:pastInput.type===t.v?"2px solid #A78BDB":"1.5px solid #e8e4db",borderRadius:8,fontSize:11,fontWeight:pastInput.type===t.v?700:400,background:pastInput.type===t.v?"#A78BDB15":"#fff",color:pastInput.type===t.v?"#A78BDB":"#666",cursor:"pointer"}}>{t.l}</button>))}</div>
        <div style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:600,color:"#666",display:"block",marginBottom:3}}>今もノイズとして残っている度合い（0-10）</label><div style={{display:"flex",gap:3}}>{[0,1,2,3,4,5,6,7,8,9,10].map(n=>(<button key={n} onClick={()=>setPastInput({...pastInput,burden:n})} style={{flex:1,padding:"5px 0",border:"none",borderRadius:5,fontSize:12,fontWeight:pastInput.burden===n?700:400,background:pastInput.burden===n?(n>7?"#E8637A":n>4?"#F5A623":"#7ED6A0"):"#f5f3ee",color:pastInput.burden===n?"#fff":"#666",cursor:"pointer"}}>{n}</button>))}</div></div>
        {[{k:"emotion",l:"当時の感情",p:"例：恐怖、焦り、自己嫌悪"},{k:"impact",l:"今への影響",p:"例：似た課題で同じ凍りつきが起こる"}].map(f=>(<div key={f.k} style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:600,color:"#666",display:"block",marginBottom:2}}>{f.l}</label><input value={pastInput[f.k]} onChange={e=>setPastInput({...pastInput,[f.k]:e.target.value})} placeholder={f.p} style={{...S.inp,border:"1.5px solid #e8e4db"}} onFocus={e=>e.target.style.borderColor="#A78BDB"} onBlur={e=>e.target.style.borderColor="#e8e4db"}/></div>))}
        <button onClick={savePast} disabled={!pastInput.event} style={{width:"100%",padding:"11px",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:pastInput.event?"pointer":"default",background:pastInput.event?"linear-gradient(135deg,#A78BDB,#1B2A4A)":"#ccc",color:"#fff",marginTop:6}}>📚 過去の体験を記録</button></div>
        {pastMemories.length>0&&<div style={S.card}><h3 style={{fontSize:14,fontWeight:700,color:"#1B2A4A",margin:"0 0 10px"}}>📚 記録（{pastMemories.length}件）</h3>{pastMemories.map((m,i)=>(<div key={m.id} style={{padding:10,borderRadius:8,background:i%2===0?"#faf9f6":"#fff",marginBottom:5,borderLeft:`4px solid ${m.burden>7?"#E8637A":m.burden>4?"#F5A623":"#7ED6A0"}`}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:600,color:"#1B2A4A"}}>{m.type==="uncompleted"?"❌":"😔"} {m.event}</span><span style={{fontSize:16,fontWeight:700,color:m.burden>7?"#E8637A":m.burden>4?"#F5A623":"#7ED6A0"}}>{m.burden}</span></div><div style={{fontSize:10,color:"#999"}}>{m.period}{m.emotion&&` | ${m.emotion}`}</div>{m.impact&&<div style={{fontSize:10,color:"#666",marginTop:3,fontStyle:"italic"}}>→ {m.impact}</div>}</div>))}</div>}</div>}

      {view==="analysis"&&<div>
        <div style={S.card}><h3 style={{fontSize:14,fontWeight:700,color:"#1B2A4A",margin:"0 0 10px"}}>トレンド</h3><div style={{display:"flex",justifyContent:"center"}}><TrendChart entries={entries}/></div></div>
        {entries.length>0&&<div style={S.card}><h3 style={{fontSize:14,fontWeight:700,color:"#1B2A4A",margin:"0 0 10px"}}>層別の平均</h3>{LAYERS.map((l,i)=>{const avg=entries.reduce((a,e)=>a+e.layers[i],0)/entries.length;return(<div key={l.id} style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{color:l.color,fontWeight:600}}>{l.icon} {l.short}</span><span style={{fontWeight:700}}>{avg.toFixed(1)}</span></div><div style={{height:7,background:"#f5f3ee",borderRadius:4}}><div style={{height:"100%",width:`${avg*10}%`,background:l.color,borderRadius:4}}/></div></div>)})}<div style={{display:"flex",justifyContent:"center",marginTop:12}}><RadarChart data={LAYERS.map((_,i)=>entries.reduce((a,e)=>a+e.layers[i],0)/entries.length)} size={180}/></div></div>}
        {entries.length>0&&<div style={S.card}><h3 style={{fontSize:14,fontWeight:700,color:"#1B2A4A",margin:"0 0 10px"}}>ステータス分布</h3>{Object.keys(STATUS).map(s=>{const c=entries.filter(e=>e.status===s).length;const pct=(c/entries.length*100).toFixed(0);return(<div key={s} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}><span style={{fontSize:11,width:90}}>{STATUS[s]}</span><div style={{flex:1,height:14,background:"#f5f3ee",borderRadius:7}}><div style={{height:"100%",width:`${pct}%`,background:STATUS_COLORS[s],borderRadius:7}}/></div><span style={{fontSize:12,fontWeight:700,width:36,textAlign:"right"}}>{pct}%</span></div>)})}</div>}
        <div style={S.card}><h3 style={{fontSize:14,fontWeight:700,color:"#1B2A4A",margin:"0 0 10px"}}>バッジ</h3><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>{BADGES.map(b=>(<div key={b.threshold} style={{textAlign:"center",padding:"8px 2px",borderRadius:8,background:entries.length>=b.threshold?"#faf9f6":"#f0f0f0",opacity:entries.length>=b.threshold?1:.4}}><div style={{fontSize:24}}>{b.emoji}</div><div style={{fontSize:8,color:"#666",marginTop:2}}>{b.label}</div></div>))}</div></div>
        <ExportButton entries={entries} pastMemories={pastMemories} />
      </div>}
    </div>
    <style>{`@keyframes pop{0%{transform:scale(.5);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}*{-webkit-tap-highlight-color:transparent}input{font-size:16px!important}`}</style>
  </div>)}
