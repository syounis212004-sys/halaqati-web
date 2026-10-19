import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

const pkg = JSON.parse(read('package.json'));
const core = read('src/core/runtime.js');
const main = read('src/main.js');
const students = read('src/features/students/runtime.js');
const auth = read('src/features/auth/runtime.js');
const master = read('src/features/master-data/runtime.js');
const sql = read('Halaqati-v2.17.6-guardian-unlink-fix.sql');

must(pkg.version === '2.18.2', 'package version must be 2.18.2');
must(core.includes("APP_VERSION_NAME='2.18.2'") && core.includes('APP_VERSION_CODE=21802'), 'runtime version mismatch');
must(main.includes("version: '2.18.2'"), 'ready event must expose 2.18.0');
must(!students.includes('${guardianDirectoryHtml()}'), 'guardian home must not render the full halaqa student directory');
must(students.includes("function guardianDirectoryHtml(){return ''}"), 'guardian directory helper must be disabled');
must(!auth.includes("db.rpc('guardian_student_directory')"), 'guardian client must not fetch the full student directory');
must(master.includes("db.rpc('set_student_primary_guardian'"), 'student guardian link sync path is missing');
must(sql.includes('delete from public.student_guardians') && sql.includes('guardian_id is distinct from p_guardian_id'), 'guardian replacement cleanup is missing');
must(sql.includes('if p_guardian_id is null then') && sql.includes('where student_id = p_student_id'), 'real unlink behavior is missing');
console.log('Halaqati v2.18.0 guardian privacy/unlink checks passed.');
