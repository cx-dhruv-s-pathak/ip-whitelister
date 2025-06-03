Checkmarx ONE IP Whitelister
A simple utility to help Checkmarx ONE administrators enforce IP-based login restrictions. If a user attempts to log in from an IP address not on the whitelist, they will be immediately logged out.

Features
Enforces login access only from pre-approved IP addresses

Automatically logs out any user connecting from a non-whitelisted IP

Easily configurable whitelist within the source code

Supports custom Checkmarx ONE URL and tenant settings

Prerequisites
Node.js (v12 or later)

npm (v6 or later)

Installation
Clone the repository
git clone https://github.com/cx-dhruv-s-pathak/ip-whitelister.git

Change into the working directory
cd ip-whitelister

Install dependencies
npm install

Configuration
By default, the allowed IP addresses are hardcoded within whitelistIP.js. Open that file and locate the WHITELISTED_IPS array. Update it to include any additional IPs you want to permit:

// whitelistIP.js (excerpt)
const whitelist = ["x.x.x.x","y.y.y.y"];
  // Add any other allowed IPs here
  

If you need to point to a different Checkmarx ONE tenant or URL, modify the following constants at the top of whitelistIP.js:


// whitelistIP.js (excerpt)
const tenant = "<tenant-name>";
const region = "<instance>";

Usage
Once you’ve configured the whitelist and updated any URL/tenant settings, you can start the utility:

node whitelistIP.js

The utility will:

Connect to your specified Checkmarx ONE tenant.

Monitor all active user sessions.

Automatically log out any user whose login IP is not found in WHITELISTED_IPS.

Customization
Adding or Removing IPs
Modify the WHITELISTED_IPS array in whitelistIP.js and save your changes. Then restart the utility.

Changing Tenant/URL
Update the CxONE_URL and CxONE_TENANT constants in whitelistIP.js to point to any other Checkmarx ONE instance or tenant.

License
This project is provided as-is under the MIT License. See the LICENSE file for details.
