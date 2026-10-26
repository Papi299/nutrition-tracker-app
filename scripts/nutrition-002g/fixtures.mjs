import { randomUUID } from 'node:crypto';
import { assertEqual, literal, fail } from './contract.mjs';

// Synthetic application fixtures use real authenticated RPCs. Auth identities
// and sessions are created exclusively by the actual pinned Auth service.
export async function populate(e,owner,count) {
 const claims=JSON.parse(Buffer.from(owner.session.access_token.split('.')[1],'base64url'));
 let step=0;
 const sql=async s=>{step++;try{return await e.sql(`begin;set local role authenticated;select set_config('request.jwt.claims',${literal(JSON.stringify(claims))},true);${s};commit;`);}catch{fail('FIXTURE_STEP_'+step);}};
 await sql("select * from public.persist_setup('Recovery owner','he','2026-09-30',2100,100,null,0)");
 await sql("select * from public.persist_setup('Recovery owner','en','2026-10-01',2200,110,0,null)");
 const codes=(await e.sql('select code from public.nutrients order by code;')).split('\n');assertEqual(codes.length,35,'NUTRIENT_DEFINITIONS');
 const definitions=count===45?JSON.parse(await e.sql('select public.nutrient_snapshot_manifest_v1();')):null;
 const values=definitions?.filter(d=>d.coreField===null).map(({code},i)=>({code,amount:i===0?0:i===1?null:Number((i+0.1234).toFixed(4))}));
 const extension={version:1,values};
 const foods=[];
 for(const [basis,q,u] of [['per_serving',1,'serving'],['per_100g',100,'g'],['per_100ml',100,'ml']]) {
  const nutrients=codes.map((code,i)=>({code,amount:code==='energy_kcal'?200:code==='protein_g'?20:code==='carbohydrates_g'?20:code==='fat_g'?5:i===0?0:1.2345}));
  const output=await sql(`select food_id from public.create_custom_food('${randomUUID()}','Synthetic ${basis}',null,'en','${basis}',${q},'${u}',${literal(JSON.stringify(nutrients))}::jsonb,'[]'::jsonb)`);
  const food=output.split('\n').find(l=>/^[a-f0-9-]{36}$/.test(l));if(!food)fail('FOOD_RPC');foods.push(food);
  const request=randomUUID(),multiplier=basis==='per_serving'?2:2;
  const args=`'${request}','2026-09-30','lunch','${food}','Historical ${basis}',null,${q*multiplier},'${u}',400,40,40,10,null`;
  if(count===45) {
   await sql(`select * from public.create_manual_diary_entry_v2(${args},${literal(JSON.stringify(extension))}::jsonb)`);
   // Exact retry must retain completed receipt and original snapshot identity.
   await sql(`select * from public.create_manual_diary_entry_v2(${args},${literal(JSON.stringify(extension))}::jsonb)`);
  } else await sql(`select * from public.create_manual_diary_entry(${args})`);
 }
 await sql(`select * from public.create_manual_diary_entry('${randomUUID()}','2026-09-29','snack',null,'Legacy unknown',null,null,null,null,0,null,0,null)`);
 const item={position:1,brand_name:null,notes:null,food_id:foods[1],food_name:'Historical meal',serving_quantity:200,serving_unit:'g',calories:400,protein_g:40,carbohydrates_g:40,fat_g:10};
 const ingredient={position:1,brand_name:null,notes:null,food_id:foods[2],ingredient_name:'Historical ingredient',quantity:200,unit:'ml',calories:400,protein_g:40,carbohydrates_g:40,fat_g:10};
 if(count===45) {
  await sql(`select * from public.persist_saved_meal_v2(null,'Recovery meal','en',${literal(JSON.stringify([{...item,item_id:null,additional_nutrient_snapshot:extension}]))},null)`);
  await sql(`select * from public.persist_recipe_v2(null,'Recovery recipe','he',2,${literal(JSON.stringify([{...ingredient,ingredient_id:null,additional_nutrient_snapshot:extension}]))},null)`);
 }else {
  await sql(`select * from public.persist_saved_meal(null,'Recovery meal','en',${literal(JSON.stringify([item]))})`);
  await sql(`select * from public.persist_recipe(null,'Recovery recipe','he',2,${literal(JSON.stringify([ingredient]))})`);
 }
 const suffix=count===45?'_v2':'';
 const mealRequest=randomUUID(),recipeRequest=randomUUID();
 const meal=`select * from public.log_saved_meal_to_diary${suffix}((select id from public.saved_meals where name='Recovery meal'),(select updated_at from public.saved_meals where name='Recovery meal'),'2026-10-01','dinner','${mealRequest}')`;
 const recipe=`select * from public.log_recipe_to_diary${suffix}((select id from public.recipes where name='Recovery recipe'),(select updated_at from public.recipes where name='Recovery recipe'),3,'2026-10-01','breakfast','${recipeRequest}')`;
 await sql(meal);await sql(meal);await sql(recipe);await sql(recipe);
 const before=await e.sql('select md5(string_agg(row_to_json(d)::text,\'\' order by id)) from public.diary_entries d;');
 await e.sql('update public.food_nutrients set amount=1 where food_id='+literal(foods[1])+'::uuid;');
 assertEqual(await e.sql('select md5(string_agg(row_to_json(d)::text,\'\' order by id)) from public.diary_entries d;'),before,'HISTORY_RECOMPUTED');
 if(count===45) {
  assertEqual(await e.sql("select count(*) from public.diary_entries where additional_nutrient_snapshot is null;"),'1','SQL_NULL_LEGACY');
  for(const table of ['diary_entries','saved_meal_items','recipe_ingredients']) {
   const result=await e.sql(`select count(*)>0 from public.${table} where additional_nutrient_snapshot is not null and (select count(*) from jsonb_object_keys(additional_nutrient_snapshot->'values'))=31 and additional_nutrient_snapshot->'values'->${literal(values[0].code)}='0'::jsonb and additional_nutrient_snapshot->'values'->${literal(values[1].code)}='null'::jsonb;`);
   assertEqual(result,'t','UNKNOWN_ZERO_'+table);
  }
 }
 return {sql,meal,recipe};
}
