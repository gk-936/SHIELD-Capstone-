import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { generateSHAPExplanations } from '../mock/generators';

interface SHAPWaterfallProps {
  pid?: number;
}

export const SHAPWaterfallPlot: React.FC<SHAPWaterfallProps> = ({ pid }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const shapData = useMemo(() => generateSHAPExplanations(), [pid]);

  useEffect(() => {
    if (!svgRef.current || !pid) return;

    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = svgRef.current.clientHeight - margin.top - margin.bottom;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Sort data for waterfall
    const sorted = [...shapData].sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));

    // Create scales
    const xScale = d3.scaleBand()
      .domain(sorted.map((_, i) => i.toString()))
      .range([0, width])
      .padding(0.3);

    const yScale = d3.scaleLinear()
      .domain([
        Math.min(-0.5, d3.min(sorted, (d: any) => d.shapValue) || -0.5),
        Math.max(0.5, d3.max(sorted, (d: any) => d.shapValue) || 0.5),
      ])
      .range([height, 0]);

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(d3.axisLeft(yScale)
        .tickSize(-width)
        .tickFormat(() => '')
      )
      .select('.domain').remove();

    // Add baseline
    svg.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#4b5563')
      .attr('stroke-width', 1);

    // Add bars
    svg.selectAll('.bar')
      .data(sorted)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (_d: any, i: number) => xScale(i.toString()) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', (d: any) => yScale(Math.max(0, d.shapValue)))
      .attr('height', (d: any) => Math.abs(yScale(d.shapValue) - yScale(0)))
      .attr('fill', (d: any) => d.direction === 'positive' ? '#ff4444' : '#00d9ff')
      .attr('opacity', 0.8)
      .style('transition', 'opacity 0.3s');

    // Add labels
    svg.selectAll('.label')
      .data(sorted)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', (_d: any, i: number) => (xScale(i.toString()) || 0) + (xScale.bandwidth() / 2))
      .attr('y', height + 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#9ca3af')
      .text((d: any) => d.featureName.substring(0, 8))
      .attr('transform', (_d: any, i: number) => {
        const x = (xScale(i.toString()) || 0) + (xScale.bandwidth() / 2);
        return `rotate(-45 ${x} ${height + 15})`;
      });

    // Add values
    svg.selectAll('.value')
      .data(sorted)
      .enter()
      .append('text')
      .attr('class', 'value')
      .attr('x', (_d: any, i: number) => (xScale(i.toString()) || 0) + (xScale.bandwidth() / 2))
      .attr('y', (d: any) => yScale(d.shapValue) - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', (d: any) => d.direction === 'positive' ? '#ff4444' : '#00d9ff')
      .text((d: any) => d.shapValue.toFixed(2));

    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .select('.domain').remove();

    // Add Y axis
    svg.append('g')
      .call(d3.axisLeft(yScale))
      .select('.domain').remove();

  }, [shapData, pid]);

  if (!pid) {
    return (
      <div className="glass rounded-lg p-4 h-full flex items-center justify-center">
        <p className="text-gray-500">Select a process to view SHAP explanations</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg p-4 h-full">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neon-cyan mb-4">
        SHAP Waterfall Plot
      </h3>
      <div className="h-80">
        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};
