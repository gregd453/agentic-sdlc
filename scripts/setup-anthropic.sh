#!/bin/bash

# Anthropic API Key Setup Script
# Version: 1.0
# Description: Configures Anthropic API key for the Agentic SDLC system

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           Anthropic API Key Configuration${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"

# Check if .env file exists
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo -e "${YELLOW}Creating .env file from template...${NC}"
        cp .env.example .env
    else
        echo -e "${RED}❌ .env.example not found!${NC}"
        exit 1
    fi
fi

# Check current API key status
current_key=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d'=' -f2)

if [ -n "$current_key" ] && [ "$current_key" != "your_key_here" ]; then
    echo -e "${GREEN}✅ Anthropic API key is already configured${NC}"
    echo -e "${YELLOW}Current key: ${NC}${current_key:0:10}..."
    echo ""
    echo -n "Do you want to update it? (y/N): "
    read -r update_key

    if [[ ! $update_key =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Keeping existing key${NC}"
        exit 0
    fi
fi

# Prompt for API key
echo -e "${YELLOW}Please enter your Anthropic API key${NC}"
echo -e "${BLUE}You can get one from: https://console.anthropic.com/api-keys${NC}"
echo ""
echo -n "API Key (sk-ant-...): "
read -rs api_key
echo ""

# Validate key format
if [[ ! $api_key =~ ^sk-ant- ]]; then
    echo -e "${RED}❌ Invalid key format. Anthropic keys start with 'sk-ant-'${NC}"
    exit 1
fi

# Update .env file
if grep -q "^ANTHROPIC_API_KEY=" .env; then
    # Update existing key
    sed -i.bak "s/^ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$api_key/" .env
else
    # Add new key
    echo "ANTHROPIC_API_KEY=$api_key" >> .env
fi

echo -e "${GREEN}✅ API key configured successfully!${NC}"

# Test the key (optional)
echo ""
echo -n "Would you like to test the API key? (y/N): "
read -r test_key

if [[ $test_key =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Testing API key...${NC}"

    # Create a simple test script
    cat > /tmp/test_anthropic.js << 'EOF'
const https = require('https');

const apiKey = process.env.ANTHROPIC_API_KEY;

const data = JSON.stringify({
    model: "claude-3-haiku-20240307",
    messages: [{role: "user", content: "Say 'API key works!' in 5 words or less"}],
    max_tokens: 20
});

const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
    }
};

const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => responseData += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            const response = JSON.parse(responseData);
            console.log('✅ API key is valid!');
            console.log('Response:', response.content[0].text);
            process.exit(0);
        } else {
            console.error('❌ API key test failed:', res.statusCode);
            console.error(responseData);
            process.exit(1);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});

req.write(data);
req.end();
EOF

    # Run the test
    source .env
    export ANTHROPIC_API_KEY
    node /tmp/test_anthropic.js
    rm /tmp/test_anthropic.js
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Configuration complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Start the system: ${CYAN}./start.sh${NC}"
echo -e "2. Create base agent: ${CYAN}./scripts/backlog-manager.sh execute TASK-006${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"