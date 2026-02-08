const dns = require('dns');

console.log('🔍 Testing DNS Resolution for MongoDB Atlas...\n');

const hostname = '_mongodb._tcp.rbdcrm.rk7usja.mongodb.net';

console.log(`Testing SRV lookup for: ${hostname}\n`);

dns.resolveSrv(hostname, (err, addresses) => {
  if (err) {
    console.error('❌ DNS SRV lookup failed:', err.message);
    console.error('Error code:', err.code);
    console.log('\n🔧 This confirms Node.js cannot resolve MongoDB SRV records on your system.');
    console.log('This is a Windows DNS configuration issue.\n');
    
    // Try standard DNS lookup as fallback
    console.log('Trying standard DNS lookup for base hostname...');
    dns.resolve4('rbdcrm.rk7usja.mongodb.net', (err2, addresses2) => {
      if (err2) {
        console.error('❌ Standard DNS also failed:', err2.message);
        console.log('\n⚠️  Your Windows system is completely blocking MongoDB Atlas DNS.');
        console.log('\n✅ SOLUTIONS:');
        console.log('1. Install Cloudflare WARP: https://1.1.1.1/');
        console.log('2. Use a VPN');
        console.log('3. Contact your ISP/network admin');
        console.log('4. Deploy to a cloud server instead of running locally');
      } else {
        console.log('✅ Standard DNS works! Found IPs:', addresses2);
        console.log('\n💡 The issue is specifically with SRV record lookups.');
        console.log('You need to use a standard connection string (not mongodb+srv://)');
      }
    });
    return;
  }

  console.log('✅ SRV Records found successfully!\n');
  addresses.forEach((addr, i) => {
    console.log(`${i + 1}. ${addr.name}:${addr.port} (priority: ${addr.priority}, weight: ${addr.weight})`);
  });

  // Build standard connection string
  const hosts = addresses
    .sort((a, b) => a.priority - b.priority)
    .map(addr => `${addr.name}:${addr.port}`)
    .join(',');

  console.log('\n📋 If you want to use a standard connection string, use this:\n');
  console.log(`mongodb://rathnabhoomidevelopers_db_user:Z9dzxSCfjlSYZNkL@${hosts}/skyup?ssl=true&replicaSet=atlas-XXXXX-shard-0&authSource=admin&retryWrites=true&w=majority`);
  console.log('\n⚠️  Replace "atlas-XXXXX-shard-0" with your actual replica set name from MongoDB Atlas');
});