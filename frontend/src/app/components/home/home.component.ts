import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, NgxEchartsModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  // SSR-safety flag: only render charts in the browser
  isBrowser = false;
  sparkOptions!: EChartsOption;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    // Detect runtime platform
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return; 

    // demo data — replace with real KPI values
    const data = [3, 5, 6, 7, 7, 8, 10, 9, 11, 13, 12, 15];

    // Minimal sparkline configuration (no axes/legend/tooltip)
    this.sparkOptions = {
      animation: false,
      tooltip: { show: false },
      legend: { show: false },
      grid: { top: 6, right: 6, bottom: 6, left: 6 },
      xAxis: { type: 'category', boundaryGap: false, show: false, data: data.map((_, i) => i) },
      yAxis: { type: 'value', show: false },
      series: [
        { type: 'line', data, smooth: true, symbol: 'none', areaStyle: {}, silent: true, lineStyle: { width: 2 } }
      ]
    };
  }
}
