import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://filetools-app.vercel.app';
const DEFAULT_IMAGE = `${BASE_URL}/logo.png`;

function setMetaTag(attributeName, attributeValue, content) {
  let element = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(url) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function setStructuredData(id, data) {
  let script = document.getElementById(id);
  if (!data) {
    if (script) script.remove();
    return;
  }
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

/**
 * MetaTags — Quản lý thẻ tiêu đề, mô tả, Open Graph, Twitter Cards, Canonical & JSON-LD
 * Đảm bảo mỗi route đều có SEO đặc thù, hỗ trợ thẻ noindex cho các trang riêng tư (dashboard/auth/tokens).
 */
export default function MetaTags({
  title,
  description = 'Bộ công cụ xử lý file đa năng: Nén, gộp, tách, che PII bảo mật PDF, chuyển đổi Office, OCR và AI tốc độ cao.',
  canonicalPath,
  ogType = 'website',
  ogImage = DEFAULT_IMAGE,
  noIndex = false,
  structuredData = null,
  breadcrumbs = null,
}) {
  const location = useLocation();

  useEffect(() => {
    // 1. Tiêu đề trang
    const fullTitle = title
      ? `${title} — FileTools Pro`
      : 'FileTools Pro — Bộ công cụ xử lý file tốc độ cao & bảo mật';
    document.title = fullTitle;

    // 2. Thẻ Meta Description & Robots
    setMetaTag('name', 'description', description);
    setMetaTag('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    // 3. Canonical URL chuẩn hóa
    const currentPath = canonicalPath || location.pathname;
    const canonicalUrl = `${BASE_URL}${currentPath === '/' ? '' : currentPath}`;
    setCanonical(canonicalUrl);

    // 4. Open Graph (Facebook, LinkedIn, Zalo)
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:image', ogImage);
    setMetaTag('property', 'og:site_name', 'FileTools Pro');
    setMetaTag('property', 'og:locale', 'vi_VN');

    // 5. Twitter Card
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', ogImage);

    // 6. Schema.org JSON-LD Structured Data
    if (structuredData) {
      setStructuredData('route-structured-data', structuredData);
    } else if (!noIndex) {
      // Default SoftwareApplication Schema
      const defaultSchema = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'FileTools Pro',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web, Windows, macOS, Android, iOS',
        description,
        url: canonicalUrl,
        offers: {
          '@type': 'Offer',
          price: '0.00',
          priceCurrency: 'USD',
        },
      };
      setStructuredData('route-structured-data', defaultSchema);
    }

    // 7. BreadcrumbList Schema nếu có
    if (breadcrumbs && breadcrumbs.length > 0) {
      const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((crumb, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: crumb.name,
          item: `${BASE_URL}${crumb.path}`,
        })),
      };
      setStructuredData('route-breadcrumb-data', breadcrumbSchema);
    }

    return () => {
      // Cleanup script tags khi đổi trang
      const routeScript = document.getElementById('route-structured-data');
      if (routeScript) routeScript.remove();
      const breadcrumbScript = document.getElementById('route-breadcrumb-data');
      if (breadcrumbScript) breadcrumbScript.remove();
    };
  }, [title, description, canonicalPath, ogType, ogImage, noIndex, structuredData, breadcrumbs, location.pathname]);

  return null;
}
