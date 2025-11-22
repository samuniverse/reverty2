# SmartFrame Scraper

## Overview
The SmartFrame Scraper is a professional image metadata extraction tool designed to scrape detailed image metadata from SmartFrame.com search results. It enables users to extract comprehensive image information and export it in JSON or CSV format. The application focuses on providing a robust and efficient solution for gathering image data, incorporating advanced features like VPN IP rotation to ensure reliable and undetected scraping operations. The project aims for 3-5x throughput increase and 95%+ success rate, with a focus on high-quality metadata and resolution guarantees.

## User Preferences
- Prefer CSV export format for scraped metadata
- Expect automatic notification when scraping completes with direct CSV export option

## System Architecture
The application features a React, Vite, and Tailwind CSS frontend with Radix UI components, an Express.js backend written in TypeScript, and leverages PostgreSQL for production (with SQLite for development). A Puppeteer-based web scraper is central to the core scraping logic.

**UI/UX Decisions**:
*   Utilizes Radix UI for components and Tailwind CSS for styling, focusing on intuitive configuration panels for features like VPN settings.

**Technical Implementations**:
*   **Bulk URL Scraping**: Supports scraping up to 50 URLs concurrently with real-time progress tracking via WebSockets.
*   **Configurable Scraping**: Options for maximum images, auto-scroll behavior, and concurrency levels.
*   **Advanced Canvas Extraction**: Implements an 11-method fallback chain for high-quality image extraction, including viewport-aware full-resolution rendering, polling for SmartFrame's CSS variables, client-side stabilization delays, content-based validation, progressive JPEG encoding, and WebP thumbnail support.
*   **Metadata Normalization**: Standardizes extracted metadata fields and enhances the `Comments` field with structured descriptions.
*   **VPN IP Rotation System**: Integrates with NordVPN and Windscribe CLIs, offering manual, time-based, count-based, and adaptive rotation strategies.
*   **Performance Optimizations**: Includes bundle size reduction, code splitting, optimized React component rendering, and build optimizations.
*   **Sequential Processing**: Ensures scraping reliability with ordered sequential mode, configurable inter-tab delays, and automatic tab activation.
*   **Caption Metadata Embedding**: Cleaned captions are embedded in image EXIF/IPTC/XMP metadata using exiftool.

**System Design Choices**:
*   **Database**: Uses Drizzle ORM, with PostgreSQL for production and SQLite for local development, featuring automatic selection and failover.
*   **Deployment**: Configured for VM deployment on Replit, crucial for Puppeteer and stateful operations.
*   **SmartFrame Optimization (5-Phase)**: Comprehensive improvements yielding 3-5x throughput and 95%+ success rate through optimized wait times, checksum validation, parallel processing enhancements, multi-paragraph caption parsing, and resolution validation.
*   **Metadata Enhancements**: Features structured caption parsing, network cache fallback, and a safe merge strategy for metadata.
*   **Reliability Improvements**: Incorporates critical wait times, error classification (PermanentError vs TransientError), file locking for concurrency using `proper-lockfile`, completed image tracking, and automatic process recycling and memory management.
*   **Resource-Efficient Canvas Extraction**: Extracts canvas as base64, converts directly in memory, and avoids intermediate file writes for faster extraction and lower memory usage.

## External Dependencies
*   **Frontend**: React, Vite, Tailwind CSS, Wouter, TanStack Query, Radix UI.
*   **Backend**: Express.js, TypeScript, Drizzle ORM, Puppeteer, WebSocket.
*   **Database**: PostgreSQL (`@neondatabase/serverless`), SQLite (`better-sqlite3`).
*   **VPN Services**: NordVPN CLI, Windscribe CLI.
*   **System Tools**: exiftool.