#!/bin/bash

# Upload CloudFormation templates to S3 for use in AWS Console
# This script uploads all templates and makes them publicly readable

set -e

# Configuration
BUCKET_NAME="wraps-assets"
REGION="us-east-1"
BACKEND_ACCOUNT_ID="${AWS_BACKEND_ACCOUNT_ID:-654654531039}"

# Templates to upload
declare -A TEMPLATES=(
  ["apps/web/public/cloudformation/wraps-console-access-role.yaml"]="cloudformation/wraps-console-access-role.yaml"
  ["apps/web/public/cloudformation/wraps-email-infrastructure.yaml"]="cloudformation/wraps-email-infrastructure.yaml"
)

echo "📦 Uploading CloudFormation templates to S3..."
echo "Bucket: s3://${BUCKET_NAME}"
echo "Backend Account ID: ${BACKEND_ACCOUNT_ID}"
echo ""

# Check if bucket exists, create if it doesn't
if ! aws s3 ls "s3://${BUCKET_NAME}" --region ${REGION} 2>/dev/null; then
  echo "🪣 Creating S3 bucket: ${BUCKET_NAME}"
  aws s3 mb "s3://${BUCKET_NAME}" --region ${REGION}

  # Enable public access for template files
  echo "🔓 Configuring public access..."
  aws s3api put-public-access-block \
    --bucket ${BUCKET_NAME} \
    --public-access-block-configuration \
      "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
    --region ${REGION}
else
  echo "✓ Bucket ${BUCKET_NAME} already exists"
fi

# Upload each template
for TEMPLATE_FILE in "${!TEMPLATES[@]}"; do
  S3_KEY="${TEMPLATES[$TEMPLATE_FILE]}"

  if [ ! -f "${TEMPLATE_FILE}" ]; then
    echo "⚠️  Skipping ${TEMPLATE_FILE} (file not found)"
    continue
  fi

  echo ""
  echo "📝 Processing ${TEMPLATE_FILE}..."

  # Upload template
  echo "⬆️  Uploading to s3://${BUCKET_NAME}/${S3_KEY}..."
  aws s3 cp "${TEMPLATE_FILE}" \
    "s3://${BUCKET_NAME}/${S3_KEY}" \
    --content-type "text/yaml" \
    --region ${REGION}

  echo "✓ Uploaded ${S3_KEY}"
done

# Create bucket policy for public read access
echo ""
echo "🔓 Setting bucket policy for public read access..."
POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadCloudFormationTemplates",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/cloudformation/*"
    }
  ]
}
EOF
)

echo "${POLICY}" | aws s3api put-bucket-policy \
  --bucket ${BUCKET_NAME} \
  --policy file:///dev/stdin \
  --region ${REGION}

echo ""
echo "✅ All templates uploaded successfully!"
echo ""
echo "Template URLs:"
for TEMPLATE_FILE in "${!TEMPLATES[@]}"; do
  S3_KEY="${TEMPLATES[$TEMPLATE_FILE]}"
  echo "  https://${BUCKET_NAME}.s3.amazonaws.com/${S3_KEY}"
done
echo ""
echo "Quick Create URLs:"
echo "  Console Access Role:"
echo "  https://console.aws.amazon.com/cloudformation/home?region=${REGION}#/stacks/create/review?stackName=wraps-console-access&templateURL=https://${BUCKET_NAME}.s3.amazonaws.com/cloudformation/wraps-console-access-role.yaml"
echo ""
echo "  Email Infrastructure:"
echo "  https://console.aws.amazon.com/cloudformation/home?region=${REGION}#/stacks/create/review?stackName=wraps-email-infrastructure&templateURL=https://${BUCKET_NAME}.s3.amazonaws.com/cloudformation/wraps-email-infrastructure.yaml"
