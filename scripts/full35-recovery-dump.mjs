// Local synthetic tampering adapter for the reviewed CLI's column INSERTs with
// up to 100000 tuples per statement. It never rewrites a Production backup.
function fail(message) { throw new Error(`Synthetic dump adapter: ${message}`); }
function quotedEnd(sql, start) {
  const quote=sql[start], escape=quote==="'" && /(?:^|[^a-z0-9_$])e$/i.test(sql.slice(Math.max(0,start-2),start));
  for(let i=start+1;i<sql.length;i++) {
    if(escape&&sql[i]==="\\"){i++;continue;}
    if(sql[i]===quote){if(sql[i+1]===quote){i++;continue;}return i;}
  }
  fail("unterminated quoted SQL value");
}
function tupleEnd(sql,start) {
  let depth=0;
  for(let i=start;i<sql.length;i++) {
    if(sql[i]==="'"||sql[i]==='"'){i=quotedEnd(sql,i);continue;}
    if(sql[i]==="(")depth++;
    else if(sql[i]===")"&&--depth===0)return i+1;
  }
  fail("unterminated INSERT tuple");
}
function findRow(sql,table,needle) {
  if(!/^(?:public|ingestion|auth)\.[a-z_]+$/.test(table))fail("invalid synthetic table name");
  const [schema,name]=table.split(".");
  const header=new RegExp(`^INSERT INTO "${schema}"\\."${name}"\\s*\\(([^)]+)\\)\\s+VALUES\\s*`,"gm");
  let match;
  while((match=header.exec(sql))) {
    const rows=[];let cursor=header.lastIndex;
    for(;;) {
      if(sql[cursor]!=="(")fail("expected column INSERT tuple");
      const end=tupleEnd(sql,cursor);rows.push({start:cursor,end});cursor=end;
      while(/\s/.test(sql[cursor]??""))cursor++;
      if(sql[cursor]!==",")break;
      cursor++;while(/\s/.test(sql[cursor]??""))cursor++;
    }
    const suffix=/^(?:ON CONFLICT DO NOTHING\s*)?;/i.exec(sql.slice(cursor));
    if(!suffix)fail("unsupported INSERT suffix");
    const index=rows.findIndex(row=>sql.slice(row.start,row.end).includes(needle));
    if(index>=0)return {rows,index,columns:match[1].split(",").map(s=>s.trim().replaceAll('"','')),statementStart:match.index,statementEnd:cursor+suffix[0].length};
    header.lastIndex=cursor+suffix[0].length;
  }
  fail(`populated INSERT tuple not found for ${table}`);
}
export function removeDumpRow(sql,table,needle="") {
  const parsed=findRow(sql,table,needle),row=parsed.rows[parsed.index];
  if(parsed.rows.length===1)return sql.slice(0,parsed.statementStart)+sql.slice(parsed.statementEnd);
  const start=parsed.index===parsed.rows.length-1?parsed.rows[parsed.index-1].end:row.start;
  const end=parsed.index===parsed.rows.length-1?row.end:parsed.rows[parsed.index+1].start;
  return sql.slice(0,start)+sql.slice(end);
}
function values(sql) {
  const result=[];let depth=0,start=0;
  for(let i=0;i<sql.length;i++) {
    if(sql[i]==="'"||sql[i]==='"'){i=quotedEnd(sql,i);continue;}
    if(sql[i]==="("||sql[i]==="[")depth++;
    else if(sql[i]===")"||sql[i]==="]")depth--;
    else if(sql[i]===","&&depth===0){result.push(sql.slice(start,i).trim());start=i+1;}
  }
  result.push(sql.slice(start).trim());return result;
}
export function replaceDumpColumn(sql,table,column,replace,needle="") {
  const parsed=findRow(sql,table,needle),row=parsed.rows[parsed.index],parts=values(sql.slice(row.start+1,row.end-1));
  const index=parsed.columns.indexOf(column);
  if(index<0||parts.length!==parsed.columns.length)fail("exact INSERT column/value inventory required");
  const replacement=replace(parts[index]);
  if(typeof replacement!=="string"||replacement===parts[index])fail("tampering must change exactly one selected column");
  parts[index]=replacement;
  return sql.slice(0,row.start)+"("+parts.join(", ")+")"+sql.slice(row.end);
}
