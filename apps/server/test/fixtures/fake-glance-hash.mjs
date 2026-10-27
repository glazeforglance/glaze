// Stand-in for `glance password:hash <pwd>` in tests. Prints a fixed bcrypt
// hash (cost 10), or Glance's message for a short password.
const args = process.argv.slice(2);
if (args[0] !== "password:hash") {
	console.log(`fake-glance-hash: unexpected arguments ${args.join(" ")}`);
	process.exit(2);
}
if ((args[1] ?? "").length < 6) {
	console.log("Password must be at least 6 characters long");
	process.exit(1);
}
console.log("$2a$10$abcdefghijklmnopqrstuuMd7SCiNe0Y6s1MbUCl0bk0KOFk9nGla");
