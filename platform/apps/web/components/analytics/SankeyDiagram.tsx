"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SankeyNode {
  id: string;
  label: string;
  value?: number;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface SankeyDiagramProps {
  title: string;
  description?: string;
  nodes: SankeyNode[];
  links: SankeyLink[];
  loading?: boolean;
  height?: number;
  formatValue?: (value: number) => string;
}

interface ProcessedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  height: number;
  totalIn: number;
  totalOut: number;
  color: string;
}

interface ProcessedLink {
  source: ProcessedNode;
  target: ProcessedNode;
  value: number;
  sourceY: number;
  targetY: number;
  height: number;
}

const NODE_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#8b5cf6", // purple
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
];

function processSankeyData(
  nodes: SankeyNode[],
  links: SankeyLink[],
  width: number,
  height: number,
  padding: number = 40,
): { nodes: ProcessedNode[]; links: ProcessedLink[] } {
  // Determine node levels (columns)
  const sourceNodes = new Set(links.map((l) => l.source));
  const targetNodes = new Set(links.map((l) => l.target));

  // Nodes that are only sources go on the left
  const leftNodes = nodes.filter((n) => sourceNodes.has(n.id) && !targetNodes.has(n.id));
  // Nodes that are only targets go on the right
  const rightNodes = nodes.filter((n) => targetNodes.has(n.id) && !sourceNodes.has(n.id));
  // Nodes that are both go in the middle
  const middleNodes = nodes.filter((n) => sourceNodes.has(n.id) && targetNodes.has(n.id));

  // Simple layout: left, middle, right columns
  const columns: SankeyNode[][] = [];
  if (leftNodes.length > 0) columns.push(leftNodes);
  if (middleNodes.length > 0) columns.push(middleNodes);
  if (rightNodes.length > 0) columns.push(rightNodes);

  // If we only have 2 columns (common case), just use source/target
  if (columns.length === 0) {
    columns.push(nodes.filter((n) => sourceNodes.has(n.id)));
    columns.push(nodes.filter((n) => targetNodes.has(n.id)));
  }

  const nodeWidth = 20;
  const usableWidth = width - padding * 2 - nodeWidth;
  const usableHeight = height - padding * 2;

  // Calculate total value for each node (max of in/out)
  const nodeValues: Record<string, { in: number; out: number }> = {};
  nodes.forEach((n) => {
    nodeValues[n.id] = { in: 0, out: 0 };
  });
  links.forEach((l) => {
    nodeValues[l.source].out += l.value;
    nodeValues[l.target].in += l.value;
  });

  const processedNodes: ProcessedNode[] = [];
  const nodeMap: Record<string, ProcessedNode> = {};

  columns.forEach((column, colIdx) => {
    const x = padding + (columns.length > 1 ? (colIdx / (columns.length - 1)) * usableWidth : 0);

    // Calculate total height needed for this column
    const totalValue = column.reduce((sum, n) => {
      const nv = nodeValues[n.id];
      return sum + Math.max(nv.in, nv.out, n.value || 0);
    }, 0);

    let currentY = padding;
    const nodeGap = 15;
    const availableHeight = usableHeight - (column.length - 1) * nodeGap;

    column.forEach((node, nodeIdx) => {
      const nv = nodeValues[node.id];
      const value = Math.max(nv.in, nv.out, node.value || 0);
      const nodeHeight =
        totalValue > 0 ? (value / totalValue) * availableHeight : availableHeight / column.length;

      const processedNode: ProcessedNode = {
        id: node.id,
        label: node.label,
        x,
        y: currentY,
        height: Math.max(nodeHeight, 20), // minimum height
        totalIn: nv.in,
        totalOut: nv.out,
        color: NODE_COLORS[nodeIdx % NODE_COLORS.length],
      };

      processedNodes.push(processedNode);
      nodeMap[node.id] = processedNode;

      currentY += processedNode.height + nodeGap;
    });
  });

  // Process links
  const sourceOffsets: Record<string, number> = {};
  const targetOffsets: Record<string, number> = {};
  processedNodes.forEach((n) => {
    sourceOffsets[n.id] = 0;
    targetOffsets[n.id] = 0;
  });

  const processedLinks = links
    .map((link): ProcessedLink | null => {
      const source = nodeMap[link.source];
      const target = nodeMap[link.target];

      if (!source || !target) {
        return null;
      }

      const sourceHeight =
        source.totalOut > 0 ? (link.value / source.totalOut) * source.height : source.height;
      const targetHeight =
        target.totalIn > 0 ? (link.value / target.totalIn) * target.height : target.height;
      const linkHeight = Math.min(sourceHeight, targetHeight);

      const sourceY = source.y + sourceOffsets[source.id];
      const targetY = target.y + targetOffsets[target.id];

      sourceOffsets[source.id] += linkHeight;
      targetOffsets[target.id] += linkHeight;

      return {
        source,
        target,
        value: link.value,
        sourceY,
        targetY,
        height: linkHeight,
      };
    })
    .filter((link): link is ProcessedLink => link !== null);

  return { nodes: processedNodes, links: processedLinks };
}

function createLinkPath(link: ProcessedLink, nodeWidth: number): string {
  const x0 = link.source.x + nodeWidth;
  const x1 = link.target.x;
  const y0Top = link.sourceY;
  const y0Bottom = link.sourceY + link.height;
  const y1Top = link.targetY;
  const y1Bottom = link.targetY + link.height;

  const curvature = 0.5;
  const xi = (x0 + x1) / 2;

  return `
    M ${x0} ${y0Top}
    C ${xi} ${y0Top}, ${xi} ${y1Top}, ${x1} ${y1Top}
    L ${x1} ${y1Bottom}
    C ${xi} ${y1Bottom}, ${xi} ${y0Bottom}, ${x0} ${y0Bottom}
    Z
  `;
}

export function SankeyDiagram({
  title,
  description,
  nodes,
  links,
  loading = false,
  height = 400,
  formatValue = (v) => v.toLocaleString(),
}: SankeyDiagramProps) {
  const width = 600;
  const nodeWidth = 20;

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>
          <div className="animate-pulse" style={{ height }}>
            <div className="flex justify-between items-center h-full">
              <div className="w-8 h-3/4 bg-muted rounded" />
              <div className="flex-1 mx-8 h-full flex flex-col justify-center gap-4">
                <div className="h-8 bg-muted rounded opacity-40" />
                <div className="h-12 bg-muted rounded opacity-30" />
                <div className="h-6 bg-muted rounded opacity-20" />
              </div>
              <div className="w-8 h-3/4 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { nodes: processedNodes, links: processedLinks } = processSankeyData(
    nodes,
    links,
    width,
    height,
  );

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            style={{ minWidth: 400, maxHeight: height }}
          >
            {/* Links */}
            <g>
              {processedLinks.map((link, idx) => (
                <path
                  key={idx}
                  d={createLinkPath(link, nodeWidth)}
                  fill={link.source.color}
                  fillOpacity={0.3}
                  stroke={link.source.color}
                  strokeOpacity={0.5}
                  strokeWidth={1}
                  className="transition-opacity hover:fill-opacity-50"
                >
                  <title>
                    {link.source.label} → {link.target.label}: {formatValue(link.value)}
                  </title>
                </path>
              ))}
            </g>

            {/* Nodes */}
            <g>
              {processedNodes.map((node, idx) => (
                <g key={node.id}>
                  <rect
                    x={node.x}
                    y={node.y}
                    width={nodeWidth}
                    height={node.height}
                    fill={node.color}
                    rx={4}
                    className="transition-opacity hover:opacity-80"
                  >
                    <title>
                      {node.label}: {formatValue(Math.max(node.totalIn, node.totalOut))}
                    </title>
                  </rect>
                  <text
                    x={node.x < width / 2 ? node.x - 8 : node.x + nodeWidth + 8}
                    y={node.y + node.height / 2}
                    textAnchor={node.x < width / 2 ? "end" : "start"}
                    dominantBaseline="middle"
                    className="text-xs fill-muted-foreground font-medium"
                  >
                    {node.label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          {processedNodes.slice(0, 6).map((node, idx) => (
            <span key={node.id} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: node.color }} />
              {node.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
